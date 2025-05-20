# docker-compose -f docker-compose.yml build workflow-caller
# docker buildx build --output=type=docker --provenance=false --tag workflow-caller -f Dockerfile .
# docker buildx create --name mybuilder --driver docker-container --use
# docker buildx build --output=type=docker \
#             --provenance=false \
#             --tag workflow-caller:amd64 \
#             --platform=linux/amd64 \
#             -f Dockerfile .
# docker load -i workflow-caller_amd64.tar
# docker buildx rm mybuilder
# docker buildx use default
docker buildx build --output=type=docker \
            --provenance=false \
            --tag workflow-caller:arm64 \
            --platform=linux/arm64 \
            -f Dockerfile .
# docker load -i workflow-caller_arm64.tar
# docker-compose -f docker-compose.yml up workflow-caller