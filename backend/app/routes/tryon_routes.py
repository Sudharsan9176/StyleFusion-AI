from flask import Blueprint, jsonify, request
from ..middleware.auth_middleware import auth_required, get_current_user
from ..models import Product, TryOnSession, db
from ..services.huggingface_service import HuggingFaceServiceError
from ..services.image_service import ImageValidationError, resolve_image_disk_path, save_uploaded_image
from ..services.virtual_tryon_service import VirtualTryOnService

tryon_bp = Blueprint('tryon', __name__, url_prefix='/api/tryon')


@tryon_bp.post('/generate')
@auth_required
def generate_tryon():
    user = get_current_user()
    product_id = request.form.get('product_id', type=int)
    if not product_id:
        return jsonify({'error': 'Please select a clothing product from the catalog.'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Selected product was not found.'}), 404

    person_file = request.files.get('person_image')
    existing_path = (request.form.get('existing_person_image_path') or '').strip()

    if person_file and person_file.filename:
        try:
            person_disk_path, person_public_url = save_uploaded_image(person_file, 'user_photos', min_dim=256)
        except ImageValidationError as exc:
            return jsonify({'error': str(exc)}), 400
    elif existing_path:
        resolved = resolve_image_disk_path(existing_path)
        if not resolved:
            return jsonify({'error': 'Previously uploaded photo not found. Please upload again.'}), 400
        person_disk_path = resolved
        person_public_url = existing_path
    else:
        return jsonify({'error': 'Please upload a photograph of yourself first.'}), 400

    service = VirtualTryOnService()
    try:
        session = service.execute_tryon(
            user_id=user.id,
            product=product,
            person_disk_path=person_disk_path,
            person_public_url=person_public_url,
            explicit_category=request.form.get('category'),
            garment_description=request.form.get('garment_description'),
            denoise_steps=request.form.get('denoise_steps', default=30, type=int),
            seed=request.form.get('seed', default=42, type=int),
        )
        return jsonify({'session': session.to_dict()}), 201
    except HuggingFaceServiceError as exc:
        return (
            jsonify(
                {
                    'error': str(exc),
                    'original_image_path': person_public_url,
                }
            ),
            exc.status_code,
        )


@tryon_bp.get('/history')
@auth_required
def tryon_history():
    user = get_current_user()
    sessions = TryOnSession.query.filter_by(user_id=user.id).order_by(TryOnSession.created_at.desc()).all()
    return jsonify({'sessions': [s.to_dict() for s in sessions]}), 200


@tryon_bp.get('/<int:session_id>')
@auth_required
def get_tryon(session_id: int):
    user = get_current_user()
    session = TryOnSession.query.get(session_id)
    if not session or (session.user_id != user.id and user.role != 'admin'):
        return jsonify({'error': 'Try-on session not found.'}), 404
    return jsonify({'session': session.to_dict()}), 200


@tryon_bp.delete('/<int:session_id>')
@auth_required
def delete_tryon(session_id: int):
    user = get_current_user()
    session = TryOnSession.query.filter_by(id=session_id, user_id=user.id).first()
    if not session:
        return jsonify({'error': 'Try-on session not found.'}), 404
    db.session.delete(session)
    db.session.commit()
    return jsonify({'message': 'Try-on session deleted.'}), 200
