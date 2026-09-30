# Build script: Copy web assets to www/ for Capacitor
# This replaces a typical 'npm run build' step since there's no bundler

$src = $PSScriptRoot
$dst = Join-Path $src "www"

Write-Host "Building Gem TD web assets into www/ ..."

# Clean destination
if (Test-Path $dst) {
    Remove-Item -Recurse -Force $dst
}
New-Item -ItemType Directory -Force -Path $dst | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dst "js") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dst "css") | Out-Null

# Copy index.html
Copy-Item (Join-Path $src "index.html") $dst

# Copy all JS files
Copy-Item (Join-Path $src "js\*.js") (Join-Path $dst "js")
Copy-Item (Join-Path $src "js\*.json") (Join-Path $dst "js")

# Copy CSS
Copy-Item (Join-Path $src "css\*.css") (Join-Path $dst "css")

Write-Host "Done! Web assets copied to www/"
Write-Host "Files in www/:"
Get-ChildItem -Recurse $dst | ForEach-Object { Write-Host "  $($_.FullName.Replace($dst, ''))" }
