#!/usr/bin/env python3
"""Operate disposable Android 14 DocumentsUI during Thornhaven's native backup QA.

Only called in a fresh CI emulator. Never uses a real phone or Play installation.
"""
import argparse
import json
import re
import shlex
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path("reports/emulator")
NAME_FILE = OUT / "qa-native-cloud-filename.txt"
DUMP_ON_DEVICE = "/sdcard/thornhaven-document-picker.xml"


def adb(*args, timeout=45):
    return subprocess.check_output(["adb", *args], timeout=timeout)


def screen(label):
    adb("shell", "uiautomator", "dump", DUMP_ON_DEVICE)
    xml = adb("shell", "cat", DUMP_ON_DEVICE).decode()
    (OUT / f"qa-native-cloud-{label}-ui.xml").write_text(xml)
    return list(ET.fromstring(xml).iter("node"))


def find(nodes, text=None, desc=None):
    for n in nodes:
        a = n.attrib
        if a.get("enabled") != "true":
            continue
        if text is not None and a.get("text") != text:
            continue
        if desc is not None and a.get("content-desc") != desc:
            continue
        return n
    return None


def tap(node):
    if node is None:
        raise RuntimeError("Expected DocumentsUI control was missing")
    b = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not b:
        raise RuntimeError("Missing DocumentsUI control bounds")
    x1, y1, x2, y2 = map(int, b.groups())
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def ui_summary(nodes):
    return [(n.get("text"), n.get("content-desc")) for n in (x.attrib for x in nodes)
            if n.get("text") or n.get("content-desc")]


def verify_saved_file(name):
    if not re.fullmatch(r"Thornhaven-[\d-]+\.json", name):
        raise RuntimeError("Unexpected Android backup filename")
    data = adb("exec-out", "sh", "-c", "cat " + shlex.quote("/sdcard/Download/" + name))
    obj = json.loads(data)
    assert obj.get("format") == "thornhaven-save" and obj.get("schema") == 1
    assert obj.get("activeSlot") == "slot1"
    rows = obj.get("slots", {})
    assert rows["slot1"]["state"]["player"]["name"] == "EmulatorUpgradeQA"
    assert rows["slot1"]["state"]["player"]["coins"] == 173
    assert rows["slot2"]["state"]["player"]["name"] == "BackupUpgradeQA"
    assert rows["slot2"]["state"]["player"]["coins"] == 441
    assert len(data) > 500
    (OUT / "qa-native-cloud-export-proof.txt").write_text(
        f"PASS: Android DocumentsUI wrote {name}, {len(data)} bytes, two intact historical save slots.\n"
    )
    print(f"PASS: actual Android document export has {len(data)} valid JSON bytes and both historical characters")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("action", choices=["save", "verify", "load"])
    args = p.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.action == "save":
        nodes = screen("save")
        title = next((n.get("text", "") for n in (x.attrib for x in nodes)
                      if n.get("resource-id") == "android:id/title"), "")
        assert re.fullmatch(r"Thornhaven-[\d-]+\.json", title), (
            "Default backup filename missing: " + repr(ui_summary(nodes)))
        # AOSP Android 14 opens ACTION_CREATE_DOCUMENT in Downloads by default.
        assert find(nodes, text="Downloads"), "Save picker not in Downloads"
        tap(find(nodes, text="SAVE"))
        NAME_FILE.write_text(title)
        print("PASS: selected Android DocumentsUI SAVE button for " + title)
    elif args.action == "verify":
        verify_saved_file(NAME_FILE.read_text().strip())
    else:
        name = NAME_FILE.read_text().strip()
        nodes = screen("load-initial")
        entry = find(nodes, text=name)
        if entry is None:
            tap(find(nodes, desc="Show roots"))
            time.sleep(2)
            roots = screen("load-roots")
            tap(find(roots, text="Downloads"))
            time.sleep(3)
            nodes = screen("load-downloads")
            entry = find(nodes, text=name)
        if entry is None:
            raise RuntimeError("Exported file absent from Android DocumentsUI: " +
                               repr(ui_summary(nodes)))
        tap(entry)
        print("PASS: selected the newly exported file through Android ACTION_OPEN_DOCUMENT")


if __name__ == "__main__":
    main()
