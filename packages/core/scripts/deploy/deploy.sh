#!/bin/bash

# Script de deploy para Vercel
echo "🚀 Iniciando deploy a Vercel..."

# Verificar que estamos en la rama correcta
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "main" ]; then
    echo "❌ Error: Debes estar en la rama 'main' para hacer deploy"
    exit 1
fi

# Verificar que no hay cambios sin commitear
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Hay cambios sin commitear. Haz commit primero."
    exit 1
fi

# Tests locales (opcional)
echo "🔍 Ejecutando tests..."
pnpm test

if [ $? -eq 0 ]; then
    echo "✅ Tests pasaron"
else
    echo "❌ Tests fallaron. Deploy abortado."
    exit 1
fi

# Push a main (trigger deploy automático en Vercel)
echo "📤 Pushing a main..."
git push origin main

echo "🎉 Deploy iniciado! Revisa en https://vercel.com/dashboard"
echo "📱 Una vez completado, tu app estará en: https://tu-proyecto.vercel.app"

