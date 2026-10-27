from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
output = root / "artifacts/adrouter-hermes-0.1.0.zip"
sources = [(path, "adrouter-collector/"+path.name) for path in sorted((root/"hermes/adrouter_collector").glob("*.py"))]
sources += [(root/"hermes/adrouter_collector/plugin.yaml", "adrouter-collector/plugin.yaml"), (root/"LICENSE", "adrouter-collector/LICENSE"), (root/"hermes/requirements.lock", "adrouter-collector/requirements.lock")]
with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path, name in sorted(sources, key=lambda item: item[1]):
        info = ZipInfo(name, date_time=(2026, 10, 27, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        info.compress_type = ZIP_DEFLATED
        archive.writestr(info, path.read_bytes(), compresslevel=9)
