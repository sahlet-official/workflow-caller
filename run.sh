# docker-compose -f docker-compose.yml build workflow-caller
docker buildx build --output=type=docker \
            --provenance=false \
            --tag workflow-caller \
            --platform=linux/arm64 \
            -f Dockerfile .
docker-compose -f docker-compose.yml up workflow-caller