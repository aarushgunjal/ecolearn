from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
OUTPUT.mkdir(parents=True, exist_ok=True)

GREEN = colors.HexColor("#173D2A")
MID_GREEN = colors.HexColor("#347E45")
LIGHT_GREEN = colors.HexColor("#EAF4E5")
PALE = colors.HexColor("#F7F8F4")
INK = colors.HexColor("#18251E")
MUTED = colors.HexColor("#627167")
GOLD = colors.HexColor("#B57B18")
LIGHT_GOLD = colors.HexColor("#FFF3D5")
LINE = colors.HexColor("#DDE6DA")
WHITE = colors.white


def register_fonts() -> tuple[str, str]:
    candidates = [
        (Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf")),
        (Path("C:/Windows/Fonts/calibri.ttf"), Path("C:/Windows/Fonts/calibrib.ttf")),
    ]
    for regular, bold in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("EcoRegular", str(regular)))
            pdfmetrics.registerFont(TTFont("EcoBold", str(bold)))
            return "EcoRegular", "EcoBold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def stylesheet():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="CoverKicker", fontName=FONT_BOLD, fontSize=10, leading=12,
        textColor=colors.HexColor("#B7DCAA"), spaceAfter=12, tracking=1.2,
    ))
    styles.add(ParagraphStyle(
        name="CoverTitle", fontName=FONT_BOLD, fontSize=31, leading=34,
        textColor=WHITE, spaceAfter=14,
    ))
    styles.add(ParagraphStyle(
        name="CoverSub", fontName=FONT, fontSize=12, leading=18,
        textColor=colors.HexColor("#E5F0E1"), spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        name="H1x", fontName=FONT_BOLD, fontSize=22, leading=27,
        textColor=GREEN, spaceBefore=4, spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        name="H2x", fontName=FONT_BOLD, fontSize=14, leading=18,
        textColor=GREEN, spaceBefore=10, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="H3x", fontName=FONT_BOLD, fontSize=10.5, leading=14,
        textColor=MID_GREEN, spaceBefore=6, spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        name="Bodyx", fontName=FONT, fontSize=9.25, leading=14,
        textColor=INK, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="Smallx", fontName=FONT, fontSize=7.8, leading=11,
        textColor=MUTED,
    ))
    styles.add(ParagraphStyle(
        name="SmallBold", fontName=FONT_BOLD, fontSize=8, leading=11,
        textColor=GREEN,
    ))
    styles.add(ParagraphStyle(
        name="Metric", fontName=FONT_BOLD, fontSize=20, leading=22,
        textColor=GREEN, alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name="MetricLabel", fontName=FONT, fontSize=7.5, leading=10,
        textColor=MUTED, alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name="TableHead", fontName=FONT_BOLD, fontSize=7.5, leading=10,
        textColor=WHITE,
    ))
    styles.add(ParagraphStyle(
        name="TableBody", fontName=FONT, fontSize=7.5, leading=10.2,
        textColor=INK,
    ))
    styles.add(ParagraphStyle(
        name="TableBodyBold", fontName=FONT_BOLD, fontSize=7.5, leading=10.2,
        textColor=GREEN,
    ))
    styles.add(ParagraphStyle(
        name="Choice", fontName=FONT, fontSize=8.5, leading=12,
        textColor=INK,
    ))
    styles.add(ParagraphStyle(
        name="Source", fontName=FONT, fontSize=7.2, leading=10,
        textColor=MUTED,
    ))
    return styles


S = stylesheet()


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = letter
    canvas.setFillColor(GREEN)
    canvas.rect(0, height - 0.18 * inch, width, 0.18 * inch, stroke=0, fill=1)
    canvas.setStrokeColor(LINE)
    canvas.line(0.62 * inch, 0.48 * inch, width - 0.62 * inch, 0.48 * inch)
    canvas.setFont(FONT, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.62 * inch, 0.28 * inch, "EcoLearn - Delaware-first sustainability learning")
    canvas.drawRightString(width - 0.62 * inch, 0.28 * inch, f"Page {doc.page}")
    canvas.restoreState()


def cover_page(canvas, doc):
    canvas.saveState()
    width, height = letter
    canvas.setFillColor(GREEN)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#28553A"))
    canvas.circle(width + 25, height - 30, 150, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#214A33"))
    canvas.circle(-25, 70, 110, stroke=0, fill=1)
    canvas.setFillColor(colors.HexColor("#A8D98F"))
    canvas.circle(width - 60, 80, 7, stroke=0, fill=1)
    canvas.setFont(FONT, 7.5)
    canvas.setFillColor(colors.HexColor("#D5E8CE"))
    footer = (
        "Prepared August 20, 2026 - current web and Expo content snapshot"
        if "Lesson" in getattr(doc, "title", "")
        else "Prepared August 20, 2026 - planning estimates, not vendor quotes"
    )
    canvas.drawString(0.68 * inch, 0.42 * inch, footer)
    canvas.restoreState()


def doc_template(path: Path, title: str):
    doc = BaseDocTemplate(
        str(path), pagesize=letter, title=title, author="EcoLearn",
        leftMargin=0.62 * inch, rightMargin=0.62 * inch,
        topMargin=0.55 * inch, bottomMargin=0.62 * inch,
    )
    cover = Frame(0.68 * inch, 0.82 * inch, 6.75 * inch, 9.65 * inch, id="cover")
    body = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover], onPage=cover_page),
        PageTemplate(id="Body", frames=[body], onPage=header_footer),
    ])
    return doc


def p(text: str, style="Bodyx"):
    return Paragraph(text, S[style])


def metric_cards(items):
    cells = [
        [p(value, "Metric") for value, _ in items],
        [p(label, "MetricLabel") for _, label in items],
    ]
    table = Table(cells, colWidths=[1.57 * inch] * len(cells), rowHeights=[0.48 * inch, 0.38 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def info_box(title: str, body: str, tone="green"):
    bg = LIGHT_GREEN if tone == "green" else LIGHT_GOLD
    accent = MID_GREEN if tone == "green" else GOLD
    data = [[p(title, "SmallBold")], [p(body, "Bodyx")]]
    box = Table(data, colWidths=[6.75 * inch])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.7, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return box


def styled_table(headers, rows, widths, font_size=7.5):
    head = [p(value, "TableHead") for value in headers]
    body = []
    for row in rows:
        body.append([p(str(value), "TableBodyBold" if index == 0 else "TableBody") for index, value in enumerate(row)])
    table = Table([head] + body, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def bullets(items):
    rows = []
    for item in items:
        rows.append([p("-", "SmallBold"), p(item, "Bodyx")])
    table = Table(rows, colWidths=[0.18 * inch, 6.52 * inch])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    return table


def cost_pdf():
    path = OUTPUT / "EcoLearn_5k_10k_Scaling_Cost_Plan.pdf"
    doc = doc_template(path, "EcoLearn 5,000-10,000 User Scaling Cost Plan")
    story = [
        Spacer(1, 1.25 * inch),
        p("ECOLEARN OPERATING PLAN", "CoverKicker"),
        p("Web + mobile costs for 5,000-10,000 users", "CoverTitle"),
        p("A scale-as-needed budget for a Delaware school pilot and a larger DSWA-backed rollout. The figures separate recurring platform costs, usage-sensitive AI, store fees, and the professional work needed for a safe education product.", "CoverSub"),
        Spacer(1, 0.28 * inch),
        metric_cards([
            ("$108-$419", "5,000-user monthly platform range"),
            ("$149-$699", "10,000-user monthly platform range"),
            ("1 call", "LLM requests per visual scan"),
            ("$124", "store accounts: first-year minimum"),
        ]),
        Spacer(1, 0.35 * inch),
        info_box("BOTTOM LINE", "The existing free stack is suitable for development and a small supervised pilot. For 5,000-10,000 users, fund Supabase Pro, production email, Netlify headroom, a commercial map provider, OpenRouter credits with hard caps, monitoring, and an Expo plan matched to mobile update MAU.", "green"),
        NextPageTemplate("Body"), PageBreak(),
        p("Planning assumptions", "H1x"),
        p("These are capacity-planning scenarios, not a claim that every registered user is active at the same moment.", "Bodyx"),
        styled_table(
            ["Input", "5,000-user case", "10,000-user case"],
            [
                ("Registered users", "5,000", "10,000"),
                ("Monthly active users", "About 2,500", "5,000-7,500"),
                ("Visual scans/month", "5,000", "15,000"),
                ("Transactional email/month", "Up to 10,000", "About 20,000"),
                ("Traffic shape", "School-day bursts", "Larger classroom bursts"),
                ("Image retention", "No scan-photo storage", "No scan-photo storage"),
                ("Concurrency", "Measured, not 5,000 simultaneous", "Load test classroom peaks"),
            ],
            [2.0 * inch, 2.3 * inch, 2.45 * inch],
        ),
        Spacer(1, 0.18 * inch),
        info_box("What the current PDF gets right", "The attached two-page plan is visually polished and correctly identifies the Apple, Google Play, OpenRouter, Supabase Pro, custom-domain, and ownership decisions needed to launch. Keep it as the short executive brief.", "green"),
        Spacer(1, 0.12 * inch),
        info_box("What it was missing", "It did not model actual 5,000/10,000-user usage, Netlify hosting credits, production SMTP, monitoring, commercial maps, AI scan volume, backups/restore testing, school privacy and accessibility work, or the difference between cloud bills and paid maintenance labor. This report fills those gaps.", "gold"),
        p("Recommended architecture at this size", "H2x"),
        bullets([
            "Netlify serves the Vite SPA; Supabase owns Auth, Postgres, RPCs, Edge Functions, and the mirrored DNREC catalog.",
            "One compressed photo produces one OpenRouter vision call. Deterministic server-side catalog matching validates the model hint; do not add one LLM call per detected object.",
            "DNREC remains the authority for item protocols and official mapped solutions. Cache catalog data and alert when its schema or sync changes.",
            "Expo/EAS produces iOS and Android builds and optional over-the-air updates. Store accounts are separate from Expo fees.",
        ]),
        PageBreak(),
        p("Recurring service budget", "H1x"),
        styled_table(
            ["Service", "5,000 users", "10,000 users", "Why / trigger"],
            [
                ("Supabase", "$25", "$25-$85", "Pro includes 100k MAU, 8 GB disk, 250 GB egress, and 7-day backups. Add compute only after measured latency or connection pressure."),
                ("Netlify", "$9-$20", "$20-$40", "Personal includes 1,000 credits; Pro starts with 3,000. Keep auto-recharge off until an owner approves the budget."),
                ("Resend SMTP", "$20", "$20", "Pro includes 50,000 transactional emails and removes the free daily cap."),
                ("OpenRouter", "$10-$100", "$30-$300", "Usage-sensitive. Replace the range with actual cost per successful scan and a 30 percent safety factor."),
                ("MapTiler", "$25", "$25", "Flex supports commercial use, 25,000 map sessions, and 500,000 API requests."),
                ("Expo/EAS", "$19-$199", "$19-$199", "Starter has 3,000 update MAU; Production has 50,000. Use overage calculator before jumping tiers."),
                ("Monitoring", "$0-$30", "$10-$30", "Start with uptime, cron/sync heartbeat, JS errors, function failures, and an alert owner."),
                ("TOTAL", "$108-$419", "$149-$699", "Monthly total. Excludes labor, tax, domain, store accounts, reviews, and unusually high AI usage."),
            ],
            [1.05 * inch, 0.82 * inch, 0.9 * inch, 3.98 * inch],
        ),
        Spacer(1, 0.18 * inch),
        p("AI cost guardrail", "H2x"),
        p("Monthly AI budget = successful visual requests x measured 30-day average cost/request x 1.30 safety factor. Use a production-only OpenRouter key, a hard monthly cap, per-user hourly limits, a global atomic reservation, no automatic retry loop, and a free text/catalog fallback when the cap is reached.", "Bodyx"),
        styled_table(
            ["Example cost per scan", "5,000 scans", "15,000 scans", "+30% reserve"],
            [
                ("$0.002", "$10", "$30", "$13 / $39"),
                ("$0.010", "$50", "$150", "$65 / $195"),
                ("$0.020", "$100", "$300", "$130 / $390"),
            ],
            [1.8 * inch, 1.55 * inch, 1.55 * inch, 1.85 * inch],
        ),
        PageBreak(),
        p("One-time, annual, and people costs", "H1x"),
        styled_table(
            ["Item", "Planning amount", "Notes"],
            [
                ("Apple Developer Program", "$99/year", "Eligible nonprofits, accredited education institutions, and government entities can request a fee waiver."),
                ("Google Play full distribution", "$25 one time", "Required for public Play distribution. A limited no-fee option is restricted to 20 devices."),
                ("Domain renewal", "$15-$40/year", "Move domain, DNS, MFA, recovery contacts, and auto-renewal to the sponsoring organization."),
                ("Privacy/legal review", "Quote separately", "Under-13 classroom deployment, consent, retention, deletion, contracts, incident response, and vendor terms."),
                ("Accessibility review", "Quote separately", "WCAG 2.2 AA, captions/transcripts, keyboard/screen-reader QA, and iOS/Android accessibility testing."),
                ("Security review", "Quote separately", "Threat model, RLS/function review, secrets, dependency posture, backups, and incident exercise."),
                ("Engineering/content support", "Staff or retainer", "Updates, release QA, DNREC/DSWA content maintenance, store reviews, and user support."),
            ],
            [1.65 * inch, 1.2 * inch, 3.9 * inch],
        ),
        Spacer(1, 0.18 * inch),
        info_box("Do not buy everything on day one", "Start with Supabase Pro, production SMTP, Netlify Personal/Pro, $25-$100 of OpenRouter credits, and free monitoring. Add MapTiler when nearby search is promoted and move Expo from Starter to Production only when mobile update MAU or release operations justify it.", "green"),
        p("Readiness gates before inviting schools", "H2x"),
        bullets([
            "Agree on the teacher/student identity model and obtain the required DSWA, school, parent, privacy, and legal decisions.",
            "Run authenticated web/mobile regression tests and a classroom-burst load test against staging.",
            "Verify backup restore, account deletion, rate limits, spend caps, DNREC sync alerts, and incident ownership.",
            "Measure scanner success, no-match rate, per-scan cost, p95 latency, and category confusion with a Delaware validation set.",
            "Provide captions or accessible alternatives for DSWA videos and a fallback when school filters block YouTube.",
        ]),
        PageBreak(),
        p("Decision summary", "H1x"),
        styled_table(
            ["Stage", "Fund now", "Wait for evidence"],
            [
                ("Development", "Small OpenRouter credit balance; preserve hard app limits", "Store accounts, commercial maps, Expo Production"),
                ("Supervised pilot", "Supabase Pro, SMTP, Netlify headroom, monitoring, Expo Starter", "Larger compute, enterprise plans"),
                ("5,000 users", "MapTiler Flex, measured AI reserve, restore drill, named incident owner", "Expo Production unless update MAU/ops need it"),
                ("10,000 users", "Load-tested compute, Pro hosting, monitoring, privacy/accessibility/security review", "Enterprise contracts unless DSWA requires SLA/SSO"),
            ],
            [1.2 * inch, 2.75 * inch, 2.8 * inch],
        ),
        Spacer(1, 0.2 * inch),
        p("Official sources checked August 20, 2026", "H2x"),
        bullets([
            '<link href="https://supabase.com/pricing">Supabase pricing</link>',
            '<link href="https://www.netlify.com/pricing/">Netlify pricing and usage credits</link>',
            '<link href="https://expo.dev/pricing">Expo Application Services pricing</link>',
            '<link href="https://resend.com/pricing">Resend pricing</link>',
            '<link href="https://openrouter.ai/pricing">OpenRouter pricing</link>',
            '<link href="https://www.maptiler.com/cloud/pricing/">MapTiler Cloud pricing</link>',
            '<link href="https://developer.apple.com/programs/enroll/">Apple Developer Program enrollment</link>',
            '<link href="https://support.google.com/googleplay/android-developer/answer/6112435">Google Play Console registration</link>',
            '<link href="https://betterstack.com/pricing">Better Stack monitoring pricing</link>',
        ]),
        Spacer(1, 0.12 * inch),
        p("Model limitations", "H2x"),
        p("Vendor prices and allowances can change. The AI range is intentionally scenario-based because the configured vision model and provider routing determine image/token cost. Reprice before approval and replace assumptions with telemetry after the first 30 days of a funded pilot.", "Bodyx"),
    ]
    doc.build(story)
    return path


@dataclass
class Lesson:
    number: int
    title: str
    topic: str
    duration: str
    xp: int
    intro: str
    facts: list[tuple[str, str]]
    question: str
    choices: list[str]
    answer: int
    explanation: str
    videos: list[str]


LESSONS = [
    Lesson(1, "The recycling loop", "Recycling basics", "4 min", 20,
           "Recycling is a system, not a wish. Careful sorting lets materials become useful things again instead of waste.",
           [("Start clean", "Food and liquid can contaminate batches. Empty containers and give them a quick rinse."),
            ("Keep it loose", "Loose items can be sorted by equipment. Plastic bags wrap around machinery, so use a dedicated drop-off."),
            ("When in doubt, check", "Rules differ between programs. Confirm the exact item instead of guessing.")],
           "Which action best helps a recycling facility sort materials?",
           ["Put recyclables in a plastic bag", "Keep empty items loose in the bin", "Recycle every item with a triangle"], 1,
           "Loose, clean, empty items are much easier for a facility to sort.",
           ["DSWA Overview", "DSWA Transfer Station Tour", "DSWA Delaware Recycling Center Tour"]),
    Lesson(2, "Plastic, decoded", "Materials", "6 min", 30,
           "Plastic numbers identify resin types, but the number alone does not promise that an item belongs in the curbside bin.",
           [("Shape matters", "Bottles, jars, and tubs are commonly accepted because there are reliable markets for them."),
            ("Film is different", "Bags, wrappers, and film are often recyclable only through store drop-off programs."),
            ("Caps stay on", "In Delaware, caps and lids can go back on accepted plastic containers. Check the exact item.")],
           "What is the safest choice for plastic bags and film?",
           ["Place them loose in curbside recycling", "Use a dedicated store drop-off if available", "Put them in with paper"], 1,
           "Film plastic tangles sorting equipment; use a dedicated film collection program.",
           ["DSWA Delaware Recycling Center Tour"]),
    Lesson(3, "Wishcycling myths", "Smart sorting", "5 min", 25,
           "Wishcycling happens when good intentions put the wrong item in recycling. It raises costs and can spoil recoverable material.",
           [("No mystery items", "If the material or program is unknown, keep the item out of curbside recycling until it is checked."),
            ("Grease changes paper", "Food-soiled cardboard and paper fibers cannot be recycled into clean paper products."),
            ("Special waste needs special handling", "Batteries, electronics, and chemicals can be hazardous. Find a dedicated collection point.")],
           "Why should a greasy pizza box stay out of paper recycling?",
           ["It is too heavy", "Grease contaminates the paper fibers", "Cardboard is never recyclable"], 1,
           "Clean cardboard is valuable; grease makes its fibers unsuitable for recycling.",
           ["DSWA Special Collection Events", "DSWA Electronics Recycling", "DSWA Delaware Landfill Tour"]),
    Lesson(4, "Food's second life", "Composting", "7 min", 35,
           "Food scraps are a resource. Composting returns nutrients to soil and helps keep methane-producing organic waste out of landfill.",
           [("Compost the right scraps", "Fruit and vegetable scraps, coffee grounds, and yard trimmings are useful starting materials."),
            ("Balance matters", "Healthy compost needs moist green material and dry brown material such as leaves or shredded paper."),
            ("Use Delaware programs", "If a backyard bin is not available, check for a Delaware food-scrap option.")],
           "Which is a useful 'brown' material for a compost pile?",
           ["Dry leaves", "A plastic wrapper", "A battery"], 0,
           "Dry leaves add carbon-rich brown material and help balance moist food scraps.",
           ["DSWA Delaware Landfill Tour"]),
    Lesson(5, "Glass and metal basics", "Materials", "5 min", 25,
           "Glass and metal are durable materials, but they still need the right preparation before they go into the bin.",
           [("Rinse first", "Leftover food or drink can make a clean container unusable, so empty and rinse items before sorting."),
            ("Separate hazardous items", "Broken glass, sharp metal, and pressurized containers may need special handling."),
            ("Check lids and caps", "Put caps and lids back on accepted containers and check DNREC guidance for the exact item.")],
           "What should you do before recycling a food jar or soda can?",
           ["Leave food residue inside", "Empty and rinse it", "Wrap it in a bag"], 1,
           "Empty, clean containers give the recycling system the best chance of success.",
           ["DSWA Delaware Recycling Center Tour"]),
    Lesson(6, "Smarter compost habits", "Organic waste", "6 min", 30,
           "Composting works best when you understand what belongs in the pile and what should stay out.",
           [("Green and brown", "Moist food scraps are green material; dry leaves and paper are brown material that add carbon and structure."),
            ("Avoid contamination", "Plastic labels, stickers, and compostable-looking packaging can cause problems if they do not break down."),
            ("Local pickup helps", "If home composting is not practical, some cities and schools collect food scraps separately.")],
           "Which item is usually safe to add to a compost bin?",
           ["Dry leaves", "A battery", "Plastic cutlery"], 0,
           "Dry leaves are a classic compost ingredient and help balance food scraps.",
           ["DSWA Delaware Landfill Tour"]),
]


def lesson_pdf():
    path = OUTPUT / "EcoLearn_Current_Lesson_Catalog.pdf"
    doc = doc_template(path, "EcoLearn Current Lesson Catalog")
    story = [
        Spacer(1, 1.25 * inch),
        p("CURRENT CONTENT INVENTORY", "CoverKicker"),
        p("EcoLearn lesson catalog", "CoverTitle"),
        p("All six current lesson items used by the web and Expo experiences, including timing, XP, instructional points, quiz choices, correct answers, explanations, and related official DSWA Education videos.", "CoverSub"),
        Spacer(1, 0.3 * inch),
        metric_cards([
            ("6", "current lessons"),
            ("175 XP", "total available lesson XP"),
            ("33 min", "combined estimated time"),
            ("7", "official DSWA videos mapped"),
        ]),
        Spacer(1, 0.35 * inch),
        info_box("CONTENT SNAPSHOT", "Web and Expo lesson IDs, titles, topics, XP, questions, choices, answers, and explanations are aligned as of August 20, 2026. The web experience additionally presents three fact cards per lesson.", "green"),
        NextPageTemplate("Body"), PageBreak(),
        p("Catalog at a glance", "H1x"),
        styled_table(
            ["#", "Lesson", "Topic", "Time", "XP", "Related DSWA focus"],
            [(lesson.number, lesson.title, lesson.topic, lesson.duration, lesson.xp, ", ".join(lesson.videos)) for lesson in LESSONS],
            [0.3 * inch, 1.45 * inch, 1.05 * inch, 0.55 * inch, 0.4 * inch, 3.0 * inch],
        ),
        Spacer(1, 0.2 * inch),
        p("Sequence design", "H2x"),
        bullets([
            "Lessons unlock in order. A correct quiz answer is required before completion is recorded.",
            "Completion uses the same UUID on web and Expo so XP and progress can sync through Supabase.",
            "Official DSWA videos are enrichment; they do not replace the Delaware DNREC item protocol used by the scanner.",
            "Teacher/classroom assignments are a deferred roadmap item and are not represented as current functionality.",
        ]),
        Spacer(1, 0.16 * inch),
        info_box("Content review note", "Several statements use general recycling or composting teaching language. Before a broad school rollout, DSWA Education should review grade level, terminology, captions/transcripts, and any claim that could vary by Delaware program.", "gold"),
    ]

    for lesson in LESSONS:
        story.append(PageBreak())
        story.extend([
            p(f"LESSON {lesson.number}  /  {lesson.topic.upper()}", "H3x"),
            p(lesson.title, "H1x"),
            metric_cards([
                (lesson.duration, "estimated time"),
                (f"{lesson.xp} XP", "completion reward"),
                ("3", "key ideas"),
                ("1 quiz", "required check"),
            ]),
            Spacer(1, 0.18 * inch),
            p("Lesson introduction", "H2x"),
            info_box("WHY IT MATTERS", lesson.intro, "green"),
            Spacer(1, 0.08 * inch),
            p("Instructional points", "H2x"),
        ])
        fact_rows = []
        for index, (title, body) in enumerate(lesson.facts, 1):
            fact_rows.append([p(str(index), "Metric"), p(title, "SmallBold"), p(body, "TableBody")])
        facts = Table(fact_rows, colWidths=[0.5 * inch, 1.35 * inch, 4.9 * inch])
        facts.setStyle(TableStyle([
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, PALE]),
            ("GRID", (0, 0), (-1, -1), 0.5, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story.extend([facts, Spacer(1, 0.12 * inch), p("Knowledge check", "H2x"), p(lesson.question, "Bodyx")])
        choice_rows = []
        for index, choice in enumerate(lesson.choices):
            correct = index == lesson.answer
            choice_rows.append([
                p(chr(65 + index), "SmallBold"),
                p(choice, "Choice"),
                p("CORRECT" if correct else "", "SmallBold"),
            ])
        choices = Table(choice_rows, colWidths=[0.38 * inch, 5.45 * inch, 0.92 * inch])
        choices.setStyle(TableStyle([
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, PALE]),
            ("BACKGROUND", (0, lesson.answer), (-1, lesson.answer), LIGHT_GREEN),
            ("GRID", (0, 0), (-1, -1), 0.45, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.extend([
            choices,
            Spacer(1, 0.1 * inch),
            info_box("ANSWER EXPLANATION", lesson.explanation, "green"),
            Spacer(1, 0.1 * inch),
            p("Related official DSWA Education videos", "H2x"),
            bullets(lesson.videos),
        ])

    story.extend([
        PageBreak(),
        p("Official DSWA Education video library", "H1x"),
        p("The seven videos below are embedded or linked contextually in EcoLearn. Scanner selection uses verified item/category words, so an electronics result selects the electronics video rather than a generic product-brand match.", "Bodyx"),
        styled_table(
            ["Video", "Primary use in EcoLearn"],
            [
                ("DSWA Overview", "Recycling-loop orientation and Learn library"),
                ("DSWA Transfer Station Tour", "Waste journey and recycling-loop context"),
                ("DSWA Delaware Landfill Tour", "Landfill, waste, and compost context"),
                ("DSWA Delaware Recycling Center Tour", "Curbside materials and sorting lessons/results"),
                ("DSWA Electronics Recycling", "Electronics lesson enrichment and electronics scan results"),
                ("DSWA Special Collection Events", "Batteries, hazardous materials, electronics, paint, chemicals"),
                ("Dover Environmental Education Center", "Educator resources and field-trip awareness"),
            ],
            [2.6 * inch, 4.15 * inch],
        ),
        Spacer(1, 0.18 * inch),
        p("Content sources", "H2x"),
        bullets([
            "Web lesson data: apps/platform-web/src/components/EcoExperience.tsx",
            "Expo lesson data: apps/mobile-ecolearn/App.tsx",
            "Video registry: apps/platform-web/src/data/dswaVideos.ts",
            '<link href="https://dswaeducation.com/videos/">Official DSWA Education video library</link>',
        ]),
        Spacer(1, 0.15 * inch),
        p("Next editorial review", "H2x"),
        bullets([
            "Ask DSWA Education to validate each lesson's grade-level language and Delaware specificity.",
            "Add captions/transcripts or text alternatives for every video used in school settings.",
            "Move lesson definitions into a shared web/mobile package to prevent future content drift.",
            "Do not implement teacher classrooms until the DSWA response and under-13 data model are approved.",
        ]),
    ])
    doc.build(story)
    return path


if __name__ == "__main__":
    generated = [cost_pdf(), lesson_pdf()]
    for item in generated:
        print(item)
