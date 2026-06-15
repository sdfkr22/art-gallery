import os
from playwright.sync_api import sync_playwright

OUT = os.path.dirname(os.path.abspath(__file__))
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=[
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--ignore-gpu-blocklist",
            "--enable-webgl",
        ],
    )
    page = browser.new_page(viewport={"width": 1600, "height": 900})
    page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

    page.goto("http://localhost:3001", wait_until="networkidle")
    page.wait_for_selector("text=The Infinite Gallery", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(OUT, "1-intro.png"))

    # dismiss intro and confirm it detaches
    page.locator("h1.intro-title").click()
    try:
        page.wait_for_selector("h1.intro-title", state="detached", timeout=6000)
    except Exception as e:
        errors.append(f"[intro-stuck] {e}")
    page.wait_for_timeout(800)
    page.screenshot(path=os.path.join(OUT, "2-timeline.png"))

    # focus the period -> artists reveal (force: label is rotated/crowded in overview)
    try:
        page.get_by_text("Post-Impressionism", exact=False).first.click(force=True)
    except Exception as e:
        errors.append(f"[click-period] {e}")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(OUT, "3-artists.png"))

    # enter Van Gogh's gallery
    try:
        page.locator("button", has_text="Vincent van Gogh").first.click(timeout=8000)
    except Exception as e:
        errors.append(f"[click-artist] {e}")
    # wait for canvas + textures
    try:
        page.wait_for_selector("canvas", timeout=20000)
    except Exception as e:
        errors.append(f"[no-canvas] {e}")
    page.wait_for_timeout(12000)
    page.screenshot(path=os.path.join(OUT, "4-gallery.png"))

    # walk down the hall toward the hero piece on the end wall
    page.keyboard.down("ShiftLeft")
    page.keyboard.down("KeyW")
    page.wait_for_timeout(7000)
    page.keyboard.up("KeyW")
    page.keyboard.up("ShiftLeft")
    page.wait_for_timeout(2500)
    page.screenshot(path=os.path.join(OUT, "5-hero.png"))

    browser.close()

print("=== console errors/warnings ===")
for e in errors[:60]:
    print(e)
print(f"total: {len(errors)}")
