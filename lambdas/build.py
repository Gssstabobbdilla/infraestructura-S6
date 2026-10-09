"""Build Linux x86_64 Lambda ZIPs from a locked npm dependency tree."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parent
build = root / '.build'
build.mkdir(exist_ok=True)
stage = Path(tempfile.mkdtemp(prefix='linux-', dir=build))
for name in ('package.json', 'package-lock.json'):
    shutil.copy2(root / name, stage / name)
npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
if not npm:
    raise SystemExit('Install Node.js and npm first.')
subprocess.run([npm, 'ci', '--omit=dev', '--include=optional', '--os=linux', '--cpu=x64', '--libc=glibc', '--no-audit', '--no-fund'], cwd=stage, check=True)
if not (stage / 'node_modules' / '@img' / 'sharp-linux-x64').is_dir():
    raise SystemExit('Missing Linux x64 sharp binary.')
for function in ('upload', 'crop'):
    destination = build / f'{function}.zip'
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.write(root / function / 'index.js', 'index.js')
        for file in sorted((stage / 'node_modules').rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(stage).as_posix())
    print(f'Built {destination}')
