# Plano 5 — Fase D do módulo Serviço/OS: documentos, fotos e assinatura

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A OS sai do balcão em papel (comprovante de entrada A4 e cupom 80 mm com QR do link, etiqueta para o aparelho, termo de garantia também em 80 mm), com fotos do aparelho na entrada e na saída e a assinatura do cliente com o dedo na entrada e na entrega.

**Architecture:** Documentos são páginas do app com CSS de impressão (`@page`), impressas pelo navegador (computador) ou salvas em PDF (celular) — spec 8.9; a casca do app já some na impressão e a folha usa os tokens `folha*`. Fotos e assinaturas vão para um bucket privado `os_arquivos` em `<loja_id>/<os_id>/...`, com políticas de storage no padrão do bucket `logos`, e uma tabela de metadados por tipo; exibição por URL assinada. Compressão da foto no navegador antes do envio.

**Tech Stack:** Next.js 16, Supabase Storage + RLS, pgTAP, Vitest, Playwright; `qrcode` (SVG no servidor) para o QR do link.

**Spec:** seções 8.2 (fotos e assinatura), 8.9 (documentos).

## Global Constraints

- **Senha do aparelho nunca é impressa**, nem em comprovante nem em etiqueta.
- **Comprovante de entrada:** loja (nome, CNPJ, endereço, telefone), OS nº, data e hora, cliente (nome e telefone, sem CPF), aparelho, cor, IMEI, defeito relatado, acessórios, estado na entrada (checklist marcado + observações), previsão, QR + endereço do link de acompanhamento, texto de termos da loja, linha de assinatura (ou a assinatura de entrada, se houver). Formatos `a4` e `80mm` na mesma rota (`?formato=`).
- **Etiqueta:** 50 × 30 mm; OS nº grande, primeiro nome do cliente, aparelho, data de entrada. Uma por página.
- **Termo de garantia:** passa a ter também o formato `80mm`; mostra a assinatura de entrega, se houver.
- **Fotos:** só JPEG/PNG/WebP; redimensionadas no navegador para no máximo 1600 px no lado maior, JPEG qualidade 0,8; até 2 MB por arquivo no bucket; até 8 por momento (`entrada`, `saida`). Os três perfis enviam; apagar só antes de a OS ser encerrada. Admin em suporte só vê.
- **Assinatura:** desenhada com o dedo (Pointer Events, sem biblioteca), guardada como PNG; uma por momento (`entrada`, `entrega`); refazer substitui. Na entrega, assinar é opcional e não bloqueia o botão Entregar.
- Tudo isolado por loja (tabela e caminho no bucket); RLS e políticas de storage testadas em pgTAP.

## Review Focus

- **Foto de outra loja pelo caminho:** política de storage confere `(storage.foldername(name))[1] = minha_loja()` e a tabela tem FK composta com a OS.
- **Foto enorme do celular:** compressão antes do envio; se o navegador não decodificar (HEIC), mensagem clara em vez de travar.
- **Comprovante de OS interna:** sem cliente e sem QR.
- **Impressão em 80 mm:** nada maior que a largura do papel (sem rolagem lateral na folha).

---

## Task 1 — Comprovante de entrada (A4 e 80 mm)

`src/app/(loja)/servico/[id]/comprovante/page.tsx`, `src/lib/qr.ts` (+ teste), botões "Comprovante" na OS. Commit `feat(documentos): comprovante de entrada em A4 e 80 mm com QR do link`.

## Task 2 — Etiqueta e termo em 80 mm

`src/app/(loja)/servico/[id]/etiqueta/page.tsx`; `formato=80mm` no termo. Commit `feat(documentos): etiqueta do aparelho e termo em 80 mm`.

## Task 3 — Fotos de entrada e saída

Migração `os_arquivos` (bucket + políticas) e tabela `os_fotos`; `src/lib/fotos.ts` (compressão pura + ações); bloco "Fotos" na OS. pgTAP do isolamento. Commit `feat(fotos): fotos do aparelho na entrada e na saída`.

## Task 4 — Assinatura do cliente

Tabela `os_assinaturas`; componente de desenho; bloco "Assinatura" na OS (entrada) e no bloco Entrega; aparece no comprovante e no termo. Commit `feat(assinatura): assinatura do cliente na entrada e na entrega`.

## Task 5 — Pré-merge

pgTAP, Vitest, Playwright (E2E: imprime comprovante sem senha; envia foto), tsc, lint, build, pegadinhas, PR.
