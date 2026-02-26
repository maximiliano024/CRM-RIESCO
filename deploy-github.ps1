# Script de deploy a GitHub
# Ejecutar este script UNA VEZ después de instalar Git y crear el repositorio en GitHub

$projectPath = "c:\Users\maxim\OneDrive\Escritorio\Planner Riesco y Asociados"
$repoUrl = "https://github.com/maximiliano024/CRM-RIESCO.git"  # ← CAMBIA ESTO

Set-Location $projectPath

git init
git add .
git commit -m "CRM Riesco & Asociados v1 con Supabase"
git branch -M main
git remote add origin $repoUrl
git push -u origin main

Write-Host "✅ Proyecto subido a GitHub exitosamente!" -ForegroundColor Green
Write-Host "Ahora ve a netlify.com para publicar en internet." -ForegroundColor Cyan
