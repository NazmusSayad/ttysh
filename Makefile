.PHONY: dev server web

dev:
	$(MAKE) -j2 server web

server:
	cargo run

web:
	cd web && nr dev
