# AI Models untuk Tukuk-OS

Folder ini menyimpan model AI untuk chat dan brain Tukuk-OS.

## Model yang Digunakan

Tukuk-OS menggunakan **Ollama** untuk menjalankan model AI secara tempatan.

### Model Default (Free Tier)

| Model | Saiz | Keterangan |
|---|---|---|
| `smollm:135m` | ~135MB | Model paling ringan, cepat untuk chat |
| `qwen2.5-coder:0.5b` | ~500MB | Model coding, lebih pintar |

### Chain Model

Tukuk-OS menggunakan **chain fallback**:
1. Cuba `smollm:135m` dahulu (pantas)
2. Jika gagal, fallback ke `qwen2.5-coder:0.5b` (lebih pintar)

## Setup

### 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Pull Model

```bash
ollama pull smollm:135m
ollama pull qwen2.5-coder:0.5b
```

### 3. Test Model

```bash
ollama run smollm:135m "Hello, how are you?"
```

### 4. Start Ollama Service

```bash
sudo systemctl enable --now ollama
```

## Konfigurasi

Edit `.env`:

```env
BRAIN_ENABLED=true
LLM_CHAIN=smollm:135m,qwen2.5-coder:0.5b
LLM_TIMEOUT=120000
OLLAMA_HOST=http://127.0.0.1:11434
```

## Model Lain yang Bisa Digunakan (Free Tier)

| Model | Saiz | Keterangan |
|---|---|---|
| `tinyllama:1.1b` | ~1GB | Model all-rounder |
| `phi3:mini` | ~2GB | Microsoft, sangat pintar |
| `gemma:2b` | ~1.5GB | Google, multilingual |
| `llama3.2:1b` | ~1GB | Meta, baru |

## Catatan

- Model **100MB** tepat adalah `smollm:135m` (~135MB)
- Model ini **free**, tidak perlukan API key
- Jalankan di server tempatan (localhost:11434)
- GPU tidak diperlukan, CPU cukup
