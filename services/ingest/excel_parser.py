from __future__ import annotations

from pathlib import Path

import pandas as pd


def extract_chunks(excel_path: Path) -> list[dict]:
    chunks: list[dict] = []
    xl = pd.ExcelFile(excel_path)
    chunk_index = 0

    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        df = df.dropna(how="all")
        if df.empty:
            continue

        cols = [str(c).strip() for c in df.columns]

        for row_idx, row in df.iterrows():
            parts: list[str] = []
            for col, val in zip(cols, row):
                if pd.notna(val) and str(val).strip():
                    parts.append(f"{col}: {val}")
            if not parts:
                continue

            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "content": " | ".join(parts),
                    "metadata": {
                        "source": excel_path.name,
                        "sheet": sheet_name,
                        "row": int(row_idx),
                        "columns": cols,
                    },
                }
            )
            chunk_index += 1

    return chunks
