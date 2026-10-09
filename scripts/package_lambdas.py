"""Prepara las carpetas que archive_file empaqueta, con dependencias Linux x64."""
from pathlib import Path
import os
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
if not npm:
    raise SystemExit('Instalar Node.js y npm primero.')
for function in ('upload', 'crop'):
    source = root / 'src' / 'lambdas' / function
    destination = root / '.build' / function
    destination.mkdir(parents=True, exist_ok=True)
    for name in ('index.mjs', 'package.json', 'package-lock.json'):
        shutil.copy2(source / name, destination / name)
    subprocess.run([npm, 'ci', '--omit=dev', '--include=optional', '--os=linux', '--cpu=x64', '--libc=glibc', '--no-audit', '--no-fund'], cwd=destination, check=True)
    if function == 'crop' and not (destination / 'node_modules' / '@img' / 'sharp-linux-x64').is_dir():
        raise SystemExit('Falta el binario sharp para Linux x64.')
    print(f'Preparado: {destination}')
