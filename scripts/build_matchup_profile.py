"""Build a compact batter-response and pitcher-command snapshot.

Sources:
- Baseball Savant Statcast Search CSV for pitch-level batter outcomes.
- OpenCommand aggregate command scores for inferred catcher-target miss.

Run from the repository root:
    python scripts/build_matchup_profile.py
"""

from __future__ import annotations

import csv
import io
import json
import math
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path


BATTER_ID = 660271
BATTER_NAME = "Shohei Ohtani"
BATTER_SIDE = "L"
PITCHER_NAME = "Nolan McLean"
PITCHER_THROWS = "R"
SEASON = 2026
START_DATE = f"{SEASON}-03-01"
END_DATE = "2026-08-30"
OUTPUT = Path("lib/generated/ohtani-2026-vs-rhp.json")

SWING_DESCRIPTIONS = {
    "foul",
    "foul_bunt",
    "foul_pitchout",
    "foul_tip",
    "hit_into_play",
    "hit_into_play_no_out",
    "hit_into_play_score",
    "missed_bunt",
    "swinging_pitchout",
    "swinging_strike",
    "swinging_strike_blocked",
}
WHIFF_DESCRIPTIONS = {
    "missed_bunt",
    "swinging_pitchout",
    "swinging_strike",
    "swinging_strike_blocked",
}
HIT_EVENTS = {"single", "double", "triple", "home_run"}
EXTRA_BASE_EVENTS = {"double", "triple", "home_run"}
FASTBALLS = {"FF", "SI", "FC"}


def fetch_text(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; StrikeYouOut/0.1; personal research project)",
            "Referer": "https://baseballsavant.mlb.com/",
        },
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return response.read().decode("utf-8-sig")


def savant_url() -> str:
    params = {
        "all": "true",
        "hfGT": "R|PO|S|",
        "player_type": "batter",
        "pitcher_throws": PITCHER_THROWS,
        "game_date_gt": START_DATE,
        "game_date_lt": END_DATE,
        "batters_lookup[]": str(BATTER_ID),
        "min_pitches": "0",
        "min_results": "0",
        "group_by": "name",
        "type": "details",
    }
    return "https://baseballsavant.mlb.com/statcast_search/csv?" + urllib.parse.urlencode(params)


def clean_rows(text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, str]] = []
    for raw in reader:
        row = {(key or "").strip(): (value or "").strip() for key, value in raw.items()}
        if row.get("pitch_type") and row.get("plate_x") and row.get("plate_z"):
            rows.append(row)
    return rows


def number(row: dict[str, str], key: str) -> float | None:
    try:
        value = float(row.get(key, ""))
        return value if math.isfinite(value) else None
    except ValueError:
        return None


def pitch_flags(row: dict[str, str]) -> dict[str, bool]:
    description = row.get("description", "")
    event = row.get("events", "")
    swing = description in SWING_DESCRIPTIONS or description.startswith("hit_into_play")
    whiff = description in WHIFF_DESCRIPTIONS
    contact = swing and not whiff
    ball_in_play = description.startswith("hit_into_play")
    return {
        "swing": swing,
        "contact": contact,
        "foul": description.startswith("foul"),
        "ball_in_play": ball_in_play,
        "hit": ball_in_play and event in HIT_EVENTS,
        "extra_base": ball_in_play and event in EXTRA_BASE_EVENTS,
    }


def is_zone(row: dict[str, str]) -> bool:
    x = number(row, "plate_x")
    z = number(row, "plate_z")
    top = number(row, "sz_top")
    bottom = number(row, "sz_bot")
    return x is not None and z is not None and top is not None and bottom is not None and abs(x) <= 0.83 and bottom <= z <= top


def hot_zone(row: dict[str, str]) -> str | None:
    if not is_zone(row):
        return None
    plate_x = number(row, "plate_x")
    plate_z = number(row, "plate_z")
    top = number(row, "sz_top")
    bottom = number(row, "sz_bot")
    assert plate_x is not None and plate_z is not None and top is not None and bottom is not None

    # Savant is catcher's perspective; the game is shown from behind the pitcher.
    screen_x = -plate_x
    horizontal = "left" if screen_x < -0.277 else "right" if screen_x > 0.277 else "middle"
    z_ratio = (plate_z - bottom) / max(0.01, top - bottom)
    vertical = "lower" if z_ratio < 1 / 3 else "upper" if z_ratio > 2 / 3 else "middle"
    return f"{vertical}_{horizontal}"


def empty_counts() -> dict[str, int]:
    return {"pitches": 0, "swings": 0, "contacts": 0, "fouls": 0, "bip": 0, "hits": 0, "extra_base": 0}


def aggregate(rows: list[dict[str, str]]) -> dict[str, int]:
    counts = empty_counts()
    for row in rows:
        flags = pitch_flags(row)
        counts["pitches"] += 1
        counts["swings"] += int(flags["swing"])
        counts["contacts"] += int(flags["contact"])
        counts["fouls"] += int(flags["foul"])
        counts["bip"] += int(flags["ball_in_play"])
        counts["hits"] += int(flags["hit"])
        counts["extra_base"] += int(flags["extra_base"])
    return counts


def rate(numerator: float, denominator: float, fallback: float) -> float:
    return numerator / denominator if denominator else fallback


def profile(counts: dict[str, int], baseline: dict[str, float], prior: int = 0) -> dict[str, float | int]:
    pitches = counts["pitches"]
    swings = counts["swings"]
    contacts = counts["contacts"]
    bip = counts["bip"]
    hits = counts["hits"]

    return {
        "sample": pitches,
        "swing": round(rate(swings + baseline["swing"] * prior, pitches + prior, baseline["swing"]), 4),
        "contact": round(rate(contacts + baseline["contact"] * prior * baseline["swing"], swings + prior * baseline["swing"], baseline["contact"]), 4),
        "foulOnContact": round(rate(counts["fouls"] + baseline["foulOnContact"] * prior * baseline["contact"], contacts + prior * baseline["contact"], baseline["foulOnContact"]), 4),
        "hitOnBip": round(rate(hits + baseline["hitOnBip"] * prior * 0.25, bip + prior * 0.25, baseline["hitOnBip"]), 4),
        "extraBaseOnHit": round(rate(counts["extra_base"] + baseline["extraBaseOnHit"] * prior * 0.08, hits + prior * 0.08, baseline["extraBaseOnHit"]), 4),
    }


def baseline_from(counts: dict[str, int]) -> dict[str, float]:
    return {
        "swing": rate(counts["swings"], counts["pitches"], 0.47),
        "contact": rate(counts["contacts"], counts["swings"], 0.75),
        "foulOnContact": rate(counts["fouls"], counts["contacts"], 0.43),
        "hitOnBip": rate(counts["hits"], counts["bip"], 0.31),
        "extraBaseOnHit": rate(counts["extra_base"], counts["hits"], 0.48),
    }


def grouped_profiles(rows: list[dict[str, str]], key_fn, baseline: dict[str, float], prior: int) -> dict[str, dict[str, float | int]]:
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        key = key_fn(row)
        if key is not None:
            groups[str(key)].append(row)
    return {key: profile(aggregate(group), baseline, prior) for key, group in sorted(groups.items())}


def build_sequence_groups(rows: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    ordered = sorted(rows, key=lambda row: (int(float(row["game_pk"])), int(float(row["at_bat_number"])), int(float(row["pitch_number"]))))
    groups: dict[str, list[dict[str, str]]] = defaultdict(list)
    previous: dict[str, str] | None = None
    previous_key: tuple[str, str] | None = None

    for row in ordered:
        current_key = (row.get("game_pk", ""), row.get("at_bat_number", ""))
        if previous is not None and current_key == previous_key:
            groups["repeat" if row["pitch_type"] == previous["pitch_type"] else "change"].append(row)

            prev_z = number(previous, "plate_z")
            prev_top = number(previous, "sz_top")
            prev_bottom = number(previous, "sz_bot")
            curr_z = number(row, "plate_z")
            curr_top = number(row, "sz_top")
            curr_bottom = number(row, "sz_bot")
            if None not in (prev_z, prev_top, prev_bottom, curr_z, curr_top, curr_bottom):
                prev_ratio = (prev_z - prev_bottom) / max(0.01, prev_top - prev_bottom)
                curr_ratio = (curr_z - curr_bottom) / max(0.01, curr_top - curr_bottom)
                if prev_ratio > 0.67 and curr_ratio < 0.33:
                    groups["highToLow"].append(row)

            prev_velocity = number(previous, "release_speed")
            curr_velocity = number(row, "release_speed")
            if prev_velocity is not None and curr_velocity is not None and abs(prev_velocity - curr_velocity) >= 7:
                groups["velocityContrast"].append(row)
            if previous["pitch_type"] in FASTBALLS and row["pitch_type"] not in FASTBALLS:
                groups["fastballToSoft"].append(row)

        previous = row
        previous_key = current_key
    return groups


def command_scores() -> dict[str, dict[str, float | int]]:
    url = "https://huggingface.co/datasets/tomdoyo/open-command/resolve/main/2026/command_scores.csv"
    rows = csv.DictReader(io.StringIO(fetch_text(url)))
    result: dict[str, dict[str, float | int]] = {}
    for row in rows:
        if row["pitcher"] == PITCHER_NAME:
            result[row["pitch_type"]] = {
                "sample": int(row["n"]),
                "medianMissInches": round(float(row["inferred_in"]), 3),
            }
    return result


def main() -> None:
    rows = clean_rows(fetch_text(savant_url()))
    if not rows:
        raise RuntimeError("Baseball Savant returned no usable pitch rows")

    all_counts = aggregate(rows)
    overall_baseline = baseline_from(all_counts)
    zone_rows = [row for row in rows if is_zone(row)]
    chase_rows = [row for row in rows if not is_zone(row)]
    zone_baseline = baseline_from(aggregate(zone_rows))
    chase_baseline = baseline_from(aggregate(chase_rows))

    sequence_groups = build_sequence_groups(rows)
    payload = {
        "metadata": {
            "batter": BATTER_NAME,
            "batterId": BATTER_ID,
            "batterSide": BATTER_SIDE,
            "pitcherThrows": PITCHER_THROWS,
            "season": SEASON,
            "through": END_DATE,
            "generatedOn": str(date.today()),
            "samplePitches": len(rows),
            "source": "Baseball Savant Statcast Search CSV",
            "commandSource": "OpenCommand inferred catcher targets, CC BY-NC-SA 4.0",
        },
        "overall": profile(all_counts, overall_baseline),
        "zone": profile(aggregate(zone_rows), zone_baseline),
        "chase": profile(aggregate(chase_rows), chase_baseline),
        "byCount": grouped_profiles(rows, lambda row: f"{row.get('balls', '0')}-{row.get('strikes', '0')}", overall_baseline, 80),
        "byPitch": grouped_profiles(rows, lambda row: row["pitch_type"], overall_baseline, 100),
        "hotZones": grouped_profiles(zone_rows, hot_zone, zone_baseline, 60),
        "sequences": {key: profile(aggregate(group), overall_baseline, 100) for key, group in sorted(sequence_groups.items())},
        "commandByPitch": command_scores(),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} from {len(rows)} pitches")


if __name__ == "__main__":
    main()
