.PHONY: dev prod test-e2e test-e2e-file migration-generate migration-run push-image

dev:
	docker compose -f docker-compose.dev.yml --env-file .env.dev up

prod:
	docker compose -f docker-compose.prod.yml --env-file .env.prod pull
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
	docker image prune -f

test-e2e:
	docker compose -f docker-compose.test.yml up --build --abort-on-container-exit

test-e2e-file:
	docker compose -f docker-compose.test.yml run --rm app npx jest $(FILE) --config ./test/jest-e2e.json

migration-generate:
	@test -n "$(NAME)" || (echo "Usage: make migration-generate NAME=<MigrationName>" && exit 1)
	npm run migration:generate -- ./src/database/migrations/$(NAME)

migration-run:
	npm run migration:run

push-image:
	docker build --target prod -t $(IMAGE_NAME):$(TAG) .
	docker push $(IMAGE_NAME):$(TAG)
