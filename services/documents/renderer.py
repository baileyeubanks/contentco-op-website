"""
ReportLab PDF renderer — produces quote/invoice PDFs matching the
Schneider Electric Customer Story quote layout exactly.

Layout reference: ContentCoOp_Quote_SchneiderElectric_CustomerStory_2026.pdf
  - Page 1: Header (logo + quote# + dates), seller/buyer blocks, Phase 1 table
  - Page 2+: Continuation phases (logo + "Quote #N | Date" header)
  - Summary page: Immediate note + phase subtotals + grand total
  - Terms page: T&C sections, Notes bullets, Acceptance signature block

Brand adapter: same layout, swap logo + accent color + footer text.
"""
import io
import os
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image, KeepTogether,
)
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.colors import HexColor

from models import QuoteDocumentPayload, BrandTheme, Phase


# ─── Constants ─── #
PAGE_W, PAGE_H = letter  # 612 x 792 pts
MARGIN_L = 0.75 * inch
MARGIN_R = 0.75 * inch
MARGIN_T = 0.75 * inch
MARGIN_B = 0.85 * inch
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

# Fonts — using built-in ReportLab fonts for maximum compatibility
FONT_BODY = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_MONO = "Courier"

# Colors
LIGHT_GRAY = HexColor("#f5f5f5")
MID_GRAY = HexColor("#666666")
DARK_GRAY = HexColor("#333333")
TABLE_HEADER_BG = HexColor("#eef3fa")


class NumberedCanvas(Canvas):
    """Canvas subclass that stamps 'Page X of Y' on every page.

    During build(), showPage() saves each page's drawing state.
    In save(), we replay all pages and add the page number with the
    correct total, then actually emit them.
    """

    def __init__(self, *args, **kwargs):
        Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.setFont(FONT_BODY, 7.5)
            self.setFillColor(MID_GRAY)
            self.drawRightString(
                PAGE_W - MARGIN_R, MARGIN_B - 20,
                "Page %d of %d" % (self._pageNumber, num_pages),
            )
            Canvas.showPage(self)
        Canvas.save(self)


def _accent(brand: BrandTheme):
    """Convert brand accent RGB tuple to ReportLab color."""
    r, g, b = brand.accent_color
    return colors.Color(r / 255, g / 255, b / 255)


def _money(amount: float) -> str:
    """Format as $X,XXX.XX"""
    return "${:,.2f}".format(amount)


class QuoteRenderer:
    """Renders a QuoteDocumentPayload to PDF bytes."""

    def __init__(self, payload: QuoteDocumentPayload):
        self.p = payload
        self.brand = payload.brand
        self.accent = _accent(payload.brand)
        self._styles = self._build_styles()

    def _build_styles(self):
        """Build paragraph styles matching the Schneider PDF."""
        ss = getSampleStyleSheet()
        accent = self.accent

        return {
            "title": ParagraphStyle(
                "QuoteTitle",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=18,
                leading=22,
                textColor=DARK_GRAY,
                alignment=TA_RIGHT,
            ),
            "subtitle": ParagraphStyle(
                "QuoteSubtitle",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=13,
                textColor=MID_GRAY,
                alignment=TA_RIGHT,
            ),
            "continuation_header": ParagraphStyle(
                "ContinuationHeader",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=13,
                textColor=MID_GRAY,
                alignment=TA_RIGHT,
            ),
            "seller_name": ParagraphStyle(
                "SellerName",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=9,
                leading=12,
                textColor=DARK_GRAY,
            ),
            "seller_detail": ParagraphStyle(
                "SellerDetail",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=8.5,
                leading=12,
                textColor=MID_GRAY,
            ),
            "buyer_label": ParagraphStyle(
                "BuyerLabel",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=8.5,
                leading=12,
                textColor=accent,
            ),
            "buyer_name": ParagraphStyle(
                "BuyerName",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=10,
                leading=14,
                textColor=DARK_GRAY,
            ),
            "buyer_detail": ParagraphStyle(
                "BuyerDetail",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=13,
                textColor=MID_GRAY,
            ),
            "phase_title": ParagraphStyle(
                "PhaseTitle",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=14,
                leading=18,
                textColor=DARK_GRAY,
                spaceAfter=8,
            ),
            "table_header": ParagraphStyle(
                "TableHeader",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=8.5,
                leading=11,
                textColor=accent,
            ),
            "item_name": ParagraphStyle(
                "ItemName",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=9,
                leading=12,
                textColor=DARK_GRAY,
            ),
            "item_desc": ParagraphStyle(
                "ItemDesc",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=8,
                leading=11,
                textColor=MID_GRAY,
            ),
            "item_qty": ParagraphStyle(
                "ItemQty",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=12,
                textColor=DARK_GRAY,
                alignment=TA_CENTER,
            ),
            "item_price": ParagraphStyle(
                "ItemPrice",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=12,
                textColor=DARK_GRAY,
                alignment=TA_RIGHT,
            ),
            "item_total": ParagraphStyle(
                "ItemTotal",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=9,
                leading=12,
                textColor=DARK_GRAY,
                alignment=TA_RIGHT,
            ),
            "subtotal_label": ParagraphStyle(
                "SubtotalLabel",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=12,
                textColor=MID_GRAY,
                alignment=TA_RIGHT,
            ),
            "subtotal_value": ParagraphStyle(
                "SubtotalValue",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=10,
                leading=14,
                textColor=DARK_GRAY,
                alignment=TA_RIGHT,
            ),
            "summary_immediate": ParagraphStyle(
                "SummaryImmediate",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=11,
                leading=15,
                textColor=DARK_GRAY,
            ),
            "summary_detail": ParagraphStyle(
                "SummaryDetail",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=13,
                textColor=MID_GRAY,
            ),
            "summary_phase": ParagraphStyle(
                "SummaryPhase",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9.5,
                leading=14,
                textColor=DARK_GRAY,
                alignment=TA_RIGHT,
            ),
            "summary_phase_amount": ParagraphStyle(
                "SummaryPhaseAmount",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9.5,
                leading=14,
                textColor=DARK_GRAY,
                alignment=TA_RIGHT,
            ),
            "grand_total_label": ParagraphStyle(
                "GrandTotalLabel",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=11,
                leading=15,
                textColor=DARK_GRAY,
                alignment=TA_RIGHT,
            ),
            "grand_total_value": ParagraphStyle(
                "GrandTotalValue",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=13,
                leading=17,
                textColor=DARK_GRAY,
                alignment=TA_RIGHT,
            ),
            "terms_heading": ParagraphStyle(
                "TermsHeading",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=14,
                leading=18,
                textColor=DARK_GRAY,
                spaceBefore=6,
                spaceAfter=6,
            ),
            "terms_section_title": ParagraphStyle(
                "TermsSectionTitle",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=9.5,
                leading=13,
                textColor=accent,
                spaceBefore=8,
                spaceAfter=2,
            ),
            "terms_body": ParagraphStyle(
                "TermsBody",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=13,
                textColor=DARK_GRAY,
            ),
            "notes_heading": ParagraphStyle(
                "NotesHeading",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=11,
                leading=15,
                textColor=DARK_GRAY,
                spaceBefore=10,
                spaceAfter=4,
            ),
            "notes_bullet": ParagraphStyle(
                "NotesBullet",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=13,
                textColor=DARK_GRAY,
                leftIndent=16,
                bulletIndent=4,
            ),
            "acceptance_heading": ParagraphStyle(
                "AcceptanceHeading",
                parent=ss["Normal"],
                fontName=FONT_BOLD,
                fontSize=11,
                leading=15,
                textColor=DARK_GRAY,
                spaceBefore=12,
                spaceAfter=2,
            ),
            "acceptance_body": ParagraphStyle(
                "AcceptanceBody",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=9,
                leading=13,
                textColor=MID_GRAY,
            ),
            "acceptance_name": ParagraphStyle(
                "AcceptanceName",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=8.5,
                leading=12,
                textColor=MID_GRAY,
            ),
            "footer": ParagraphStyle(
                "Footer",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=7.5,
                leading=10,
                textColor=MID_GRAY,
            ),
            "payment_handle": ParagraphStyle(
                "PaymentHandle",
                parent=ss["Normal"],
                fontName=FONT_BODY,
                fontSize=8.5,
                leading=12,
                textColor=MID_GRAY,
                alignment=TA_CENTER,
            ),
        }

    # ─── Header / Footer callbacks ─── #

    def _draw_header_page1(self, canvas, doc):
        """First page: logo + title block + seller/buyer info."""
        canvas.saveState()
        s = self._styles
        p = self.p

        # Logo (top-left)
        logo_path = self.brand.logo_path
        if logo_path and os.path.exists(logo_path):
            canvas.drawImage(
                logo_path, MARGIN_L, PAGE_H - MARGIN_T - 50,
                width=120, height=50, mask="auto", preserveAspectRatio=True,
            )

        # Title block (top-right)
        title_x = PAGE_W - MARGIN_R
        title_y = PAGE_H - MARGIN_T - 8
        canvas.setFont(FONT_BOLD, 18)
        canvas.setFillColor(DARK_GRAY)
        doc_label = "Price Quote" if p.document_type == "quote" else "Invoice"
        canvas.drawRightString(title_x, title_y, "%s #%d" % (doc_label, p.quote_number))

        # Subtitle lines
        canvas.setFont(FONT_BODY, 9)
        canvas.setFillColor(MID_GRAY)
        y = title_y - 16
        if p.ref_name:
            canvas.drawRightString(title_x, y, "Ref: %s" % p.ref_name)
            y -= 13
        canvas.drawRightString(title_x, y, "Issue Date: %s" % p.issue_date)
        y -= 13
        canvas.drawRightString(title_x, y, "Valid Until: %s" % p.valid_until)

        canvas.restoreState()

    def _draw_header_continuation(self, canvas, doc):
        """Continuation pages: compact logo + "Quote #N | Date" drawn IN the top margin."""
        canvas.saveState()

        logo_path = self.brand.logo_path
        if logo_path and os.path.exists(logo_path):
            # Logo: 30 pts tall, entirely in the margin area (above content frame)
            canvas.drawImage(
                logo_path, MARGIN_L, PAGE_H - 48,
                width=90, height=30, mask="auto", preserveAspectRatio=True,
            )

        canvas.setFont(FONT_BODY, 9)
        canvas.setFillColor(MID_GRAY)
        doc_label = "Price Quote" if self.p.document_type == "quote" else "Invoice"
        canvas.drawRightString(
            PAGE_W - MARGIN_R,
            PAGE_H - 32,
            "%s #%d  |  %s" % (doc_label, self.p.quote_number, self.p.issue_date),
        )

        canvas.restoreState()

    def _draw_footer(self, canvas, doc):
        """Footer: thin rule + contact text + page number."""
        canvas.saveState()
        y = MARGIN_B - 20

        # Thin horizontal rule
        canvas.setStrokeColor(HexColor("#cccccc"))
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_L, y + 12, PAGE_W - MARGIN_R, y + 12)

        # Footer text
        canvas.setFont(FONT_BODY, 7.5)
        canvas.setFillColor(MID_GRAY)
        canvas.drawString(MARGIN_L, y, self.brand.footer_contact)

        # Page number is stamped by NumberedCanvas.save() after all pages are known
        canvas.restoreState()

    # ─── Content builders ─── #

    def _build_seller_buyer_block(self):
        """Seller info (left) + payment handle (center) + buyer info (below)."""
        s = self._styles
        p = self.p
        elements = []

        # Seller block
        elements.append(Spacer(1, 70))  # space below header
        elements.append(Paragraph(p.seller.legal_name, s["seller_name"]))
        for line in [
            p.seller.address_line1,
            p.seller.address_line2,
            p.seller.country,
            p.seller.email,
            "Phone: %s" % p.seller.phone if p.seller.phone else "",
            "Company ID: %s" % p.seller.company_id if p.seller.company_id else "",
        ]:
            if line:
                elements.append(Paragraph(line, s["seller_detail"]))

        # Payment handle (centered below seller)
        if p.seller.payment_handle:
            elements.append(Spacer(1, 4))
            elements.append(Paragraph(p.seller.payment_handle, s["payment_handle"]))

        elements.append(Spacer(1, 16))

        # Buyer block
        elements.append(Paragraph("Customer Info:", s["buyer_label"]))
        elements.append(Paragraph(p.buyer.name, s["buyer_name"]))
        if p.buyer.email:
            elements.append(Paragraph(p.buyer.email, s["buyer_detail"]))
        if p.buyer.company:
            elements.append(Paragraph(p.buyer.company, s["buyer_detail"]))

        elements.append(Spacer(1, 20))

        return elements

    def _build_phase_table(self, phase: Phase):
        """Build a phase header + line item table + subtotal row."""
        s = self._styles
        elements = []

        # Phase heading: "Phase N — Name  |  Date"
        idx = self.p.phases.index(phase) + 1
        heading = "Phase %d &mdash; %s  |  %s" % (idx, phase.name, phase.date_label)
        elements.append(Paragraph(heading, s["phase_title"]))

        # Table data
        col_widths = [CONTENT_W * 0.48, CONTENT_W * 0.12, CONTENT_W * 0.20, CONTENT_W * 0.20]

        # Header row
        header_row = [
            Paragraph("Product or Service", s["table_header"]),
            Paragraph("Quantity", s["table_header"]),
            Paragraph("Price", s["table_header"]),
            Paragraph("Line Total", s["table_header"]),
        ]

        rows = [header_row]

        for item in phase.line_items:
            # Name + description cell (stacked)
            name_para = Paragraph(item.name, s["item_name"])
            desc_text = item.description.replace("\n", "<br/>")
            desc_para = Paragraph(desc_text, s["item_desc"])
            name_cell = [name_para, Spacer(1, 2), desc_para]

            qty_cell = Paragraph(str(item.quantity), s["item_qty"])
            price_cell = Paragraph(_money(item.price), s["item_price"])
            total_cell = Paragraph(_money(item.line_total), s["item_total"])

            rows.append([name_cell, qty_cell, price_cell, total_cell])

        # Subtotal row
        rows.append([
            "", "",
            Paragraph("Phase %d Subtotal:" % idx, s["subtotal_label"]),
            Paragraph(_money(phase.subtotal), s["subtotal_value"]),
        ])

        table = Table(rows, colWidths=col_widths)

        # Style the table
        style_cmds = [
            # Header row background
            ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
            # Header row bottom border
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, HexColor("#d0d8e4")),
            # Subtotal row top border
            ("LINEABOVE", (2, -1), (-1, -1), 0.5, HexColor("#d0d8e4")),
            # Vertical alignment
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            # Padding
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            # Light row separators (skip header and subtotal)
        ]
        for i in range(1, len(rows) - 1):
            style_cmds.append(
                ("LINEBELOW", (0, i), (-1, i), 0.25, HexColor("#e8e8e8"))
            )

        table.setStyle(TableStyle(style_cmds))
        elements.append(table)
        elements.append(Spacer(1, 24))

        # Wrap in KeepTogether so a phase won't start on one page and
        # split its first row onto the next.  If the phase is taller than
        # a full page, ReportLab will split it anyway (that's fine).
        return [KeepTogether(elements)]

    def _build_summary_page(self):
        """Build the summary page with phase subtotals + grand total."""
        s = self._styles
        p = self.p
        elements = []

        elements.append(Spacer(1, 16))  # small breathing room below margin header

        # Two-column layout: immediate note (left) + phase totals table (right)
        # Build as a table with 2 columns

        # Left column content
        left_parts = []
        if p.summary.immediate_note:
            left_parts.append(Paragraph(p.summary.immediate_note, s["summary_immediate"]))
            left_parts.append(Spacer(1, 6))
        if p.summary.immediate_detail:
            left_parts.append(Paragraph(p.summary.immediate_detail, s["summary_detail"]))
        if p.summary.deposit_note:
            left_parts.append(Spacer(1, 6))
            left_parts.append(Paragraph(p.summary.deposit_note, s["summary_detail"]))

        # Right column: phase subtotals table (labeled "Phase N:")
        right_rows = []
        for idx, (phase_name, subtotal) in enumerate(p.phase_subtotals, 1):
            right_rows.append([
                Paragraph("Phase %d:" % idx, s["summary_phase"]),
                Paragraph(_money(subtotal), s["summary_phase_amount"]),
            ])

        # Separator line before total
        right_rows.append(["", ""])  # empty spacer row

        # Grand total row
        right_rows.append([
            Paragraph("Total:", s["grand_total_label"]),
            Paragraph(_money(p.total), s["grand_total_value"]),
        ])

        right_table = Table(right_rows, colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.22])
        right_style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            # Top thin rule above first phase row
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, HexColor("#d0d8e4")),
            # Bold rule above grand total
            ("LINEABOVE", (0, -1), (-1, -1), 1.5, self.accent),
        ]
        right_table.setStyle(TableStyle(right_style))

        # Combine into two-column layout
        layout_table = Table(
            [[left_parts, right_table]],
            colWidths=[CONTENT_W * 0.50, CONTENT_W * 0.50],
        )
        layout_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))

        elements.append(layout_table)
        return elements

    def _build_terms_page(self):
        """Terms & Conditions + Notes + Acceptance."""
        s = self._styles
        p = self.p
        elements = []

        elements.append(Spacer(1, 8))  # small breathing room below margin header

        # Terms heading
        elements.append(Paragraph("Terms &amp; Conditions", s["terms_heading"]))

        # Each term section
        for title, body in p.terms.sections.items():
            elements.append(Paragraph(title, s["terms_section_title"]))
            elements.append(Paragraph(body, s["terms_body"]))

        # Divider
        elements.append(HRFlowable(
            width="100%", thickness=0.5, color=HexColor("#d0d8e4"),
            spaceBefore=6, spaceAfter=4,
        ))

        # Notes
        if p.notes:
            elements.append(Paragraph("Notes", s["notes_heading"]))
            for note in p.notes:
                elements.append(Paragraph(
                    "&bull;  %s" % note, s["notes_bullet"]
                ))

        # Divider
        elements.append(HRFlowable(
            width="100%", thickness=0.5, color=HexColor("#d0d8e4"),
            spaceBefore=6, spaceAfter=4,
        ))

        # Acceptance
        a = p.acceptance
        elements.append(Paragraph("Acceptance", s["acceptance_heading"]))
        elements.append(Paragraph(
            "By signing below, you agree to the terms outlined in this %s." % p.document_type,
            s["acceptance_body"],
        ))
        elements.append(Spacer(1, 20))

        # Signature lines — two-column
        sig_data = [[
            [
                Paragraph("_" * 42, s["acceptance_body"]),
                Paragraph("Client Signature", s["acceptance_name"]),
                Paragraph(
                    "%s  |  %s" % (a.client_name, a.client_company) if a.client_company else a.client_name,
                    s["acceptance_name"],
                ),
                Spacer(1, 8),
                Paragraph("_" * 32, s["acceptance_body"]),
                Paragraph("Date", s["acceptance_name"]),
            ],
            [
                Paragraph("_" * 42, s["acceptance_body"]),
                Paragraph(self.brand.company_name, s["acceptance_name"]),
                Paragraph(
                    "%s  |  %s" % (a.seller_name, a.seller_title) if a.seller_title else a.seller_name,
                    s["acceptance_name"],
                ),
                Spacer(1, 8),
                Paragraph("_" * 32, s["acceptance_body"]),
                Paragraph("Date", s["acceptance_name"]),
            ],
        ]]
        sig_table = Table(sig_data, colWidths=[CONTENT_W * 0.50, CONTENT_W * 0.50])
        sig_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(sig_table)

        # Confidentiality note at very bottom
        elements.append(Spacer(1, 16))
        elements.append(Paragraph(
            self.brand.confidentiality_note,
            ParagraphStyle("ConfNote", parent=self._styles["footer"], fontSize=7, textColor=MID_GRAY),
        ))

        return elements

    # ─── Main render ─── #

    def render(self, output_path: Optional[str] = None) -> bytes:
        """
        Render the quote/invoice PDF.
        Returns PDF bytes. If output_path given, also writes to disk.
        """
        buf = io.BytesIO()

        doc = SimpleDocTemplate(
            buf,
            pagesize=letter,
            leftMargin=MARGIN_L,
            rightMargin=MARGIN_R,
            topMargin=MARGIN_T,
            bottomMargin=MARGIN_B,
        )

        story = []

        # ── Page 1: Header + Seller/Buyer + First phase(s) ── #
        story.extend(self._build_seller_buyer_block())

        for i, phase in enumerate(self.p.phases):
            story.extend(self._build_phase_table(phase))

        # ── Summary page ── #
        story.append(PageBreak())
        story.extend(self._build_summary_page())

        # ── Terms page ── #
        if self.p.terms.sections or self.p.notes:
            story.append(PageBreak())
            story.extend(self._build_terms_page())

        # Track total pages for footer
        self._page_count = 0

        def on_page_1(canvas, doc):
            self._page_count += 1
            self._draw_header_page1(canvas, doc)
            self._draw_footer(canvas, doc)

        def on_later_pages(canvas, doc):
            self._page_count += 1
            self._draw_header_continuation(canvas, doc)
            self._draw_footer(canvas, doc)

        doc.build(
            story,
            onFirstPage=on_page_1,
            onLaterPages=on_later_pages,
            canvasmaker=NumberedCanvas,
        )

        pdf_bytes = buf.getvalue()
        buf.close()

        if output_path:
            with open(output_path, "wb") as f:
                f.write(pdf_bytes)

        return pdf_bytes


def render_quote(payload: QuoteDocumentPayload, output_path: Optional[str] = None) -> bytes:
    """Convenience function to render a quote PDF."""
    return QuoteRenderer(payload).render(output_path)
