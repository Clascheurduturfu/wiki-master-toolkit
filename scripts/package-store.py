"""Build the Chrome Web Store ZIP from a narrow list of extension resources."""

import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    output = args.output or root / 'releases' / f'wiki-master-toolkit-{manifest["version"]}-rc1.zip'
    files = {'manifest.json', 'PRIVACY.md', 'ATTRIBUTION.md', 'docs/UPSTREAM-README.fr.md'}
    files.update(p.name for p in root.iterdir() if p.is_file() and p.suffix in {'.js', '.css'})
    for directory in ['bridge', 'features', 'icons']:
        files.update(p.relative_to(root).as_posix() for p in (root / directory).rglob('*')
                     if p.is_file() and p.suffix in {'.js', '.css', '.png'})
    required = set(manifest['icons'].values())
    for group in manifest['content_scripts']:
        required.update(group.get('js', []))
        required.update(group.get('css', []))
    if required - files:
        raise ValueError(f'Missing manifest resources: {sorted(required - files)}')
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(files):
            archive.write(root / name, name)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError('Damaged package')
        if json.loads(archive.read('manifest.json')) != manifest:
            raise ValueError('Manifest mismatch')
    print(json.dumps({'file': str(output.resolve()), 'version': manifest['version'],
                      'entries': len(files), 'bytes': output.stat().st_size,
                      'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
