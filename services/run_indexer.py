import logging
import sys

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    from rag.indexer import build_index

    result = build_index()
    processed = len(result["processed"])
    errors = len(result["errors"])
    logger.info("indexing complete: %d processed, %d errors", processed, errors)
    for e in result["errors"]:
        logger.error("failed: %s — %s", e["file"], e["reason"])
    sys.exit(1 if errors else 0)
