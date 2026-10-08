#!/bin/bash
set -e

echo "=== Setup AI Models for Tukuk-OS ==="
echo

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "Ollama already installed: $(ollama --version)"
fi

# Pull models
echo
echo "Pulling AI models..."
echo "1. smollm:135m (~91MB) - Fast chat model"
ollama pull smollm:135m

echo "2. qwen2.5-coder:0.5b (~397MB) - Coding model"
ollama pull qwen2.5-coder:0.5b

# Start Ollama service
echo
echo "Starting Ollama service..."
if command -v systemctl &> /dev/null; then
    sudo systemctl enable --now ollama 2>/dev/null || true
fi

# Test
echo
echo "Testing Ollama..."
curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | head -2

echo
echo "=== Setup Complete ==="
echo "Models ready for Tukuk-OS chat"
