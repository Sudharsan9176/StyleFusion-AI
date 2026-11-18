from ..models import Product, TryOnSession, db
from .huggingface_service import HuggingFaceService, HuggingFaceServiceError
from .image_service import resolve_image_disk_path


def map_tryon_category(product_category: str, explicit_category: str | None = None) -> str:
    if explicit_category in ('upper_body', 'lower_body', 'dresses'):
        return explicit_category
    lower = product_category.lower()
    if 'dress' in lower:
        return 'dresses'
    if 'jean' in lower or 'pant' in lower or 'trouser' in lower:
        return 'lower_body'
    return 'upper_body'


class VirtualTryOnService:
    def __init__(self, hf_service: HuggingFaceService | None = None):
        self.hf_service = hf_service or HuggingFaceService()

    def execute_tryon(
        self,
        user_id: int,
        product: Product,
        person_disk_path: str,
        person_public_url: str,
        explicit_category: str | None = None,
        garment_description: str | None = None,
        denoise_steps: int = 30,
        seed: int = 42,
    ) -> TryOnSession:
        garment_path_or_url = resolve_image_disk_path(product.image) or product.image
        tryon_category = map_tryon_category(product.category, explicit_category)

        session = TryOnSession(
            user_id=user_id,
            product_id=product.id,
            original_image_path=person_public_url,
            generated_image_path=None,
            model_name=self.hf_service.model_id,
            status='processing',
        )
        db.session.add(session)
        db.session.commit()

        try:
            _, generated_url, used_model = self.hf_service.generate_tryon(
                person_image_path=person_disk_path,
                garment_image_path_or_url=garment_path_or_url,
                category=tryon_category,
                garment_description=garment_description or f'{product.name} ({product.category})',
                denoise_steps=denoise_steps,
                seed=seed,
            )
            session.generated_image_path = generated_url
            session.model_name = used_model
            session.status = 'completed'
            session.error_message = None
            db.session.commit()
            return session
        except HuggingFaceServiceError as exc:
            session.status = 'failed'
            session.error_message = str(exc)
            db.session.commit()
            raise
        except Exception as exc:
            session.status = 'failed'
            session.error_message = str(exc)
            db.session.commit()
            raise HuggingFaceServiceError(str(exc), 502) from exc
