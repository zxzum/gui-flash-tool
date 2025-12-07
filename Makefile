.PHONY: frontend-install frontend-build run clean-frontend

frontend-install:
cd frontend && npm install

frontend-build: frontend-install
cd frontend && npm run build

run: frontend-build
python -m app.main

clean-frontend:
rm -rf frontend/node_modules frontend/dist
