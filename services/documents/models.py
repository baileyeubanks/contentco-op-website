"""
Document data models for the shared quote/invoice PDF engine.

Two distinct intake flows:
  - CCO: creative_brief -> scope_draft -> proposal/quote
  - ACS: service_quote_request -> service_quote -> booking/invoice

Both normalize into QuoteDocumentPayload for rendering.
"""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class LineItem:
    name: str
    description: str  # 1-2 lines under the bold name
    quantity: int = 1
    price: float = 0.0

    @property
    def line_total(self) -> float:
        return self.quantity * self.price


@dataclass
class Phase:
    name: str           # e.g. "B-Roll"
    date_label: str     # e.g. "March 12, 2026" or "TBD, 2026"
    line_items: List[LineItem] = field(default_factory=list)

    @property
    def subtotal(self) -> float:
        return sum(item.line_total for item in self.line_items)


@dataclass
class SellerInfo:
    legal_name: str     # "Eubanks Marketing Inc. DBA Content Co-op"
    address_line1: str  # "322 Wilcrest Dr. Houston, TX 77042"
    address_line2: str  # "Houston, Texas"
    country: str = "United States"
    email: str = ""
    phone: str = ""
    company_id: str = ""
    payment_handle: str = ""  # "Zelle Payments: bailey@contentco-op.com"


@dataclass
class BuyerInfo:
    name: str           # "Madeline Lu"
    email: str = ""
    company: str = ""


@dataclass
class TermsBlock:
    """Each key is a section header, value is the body text."""
    sections: dict = field(default_factory=dict)
    # e.g. {"Payment": "50% deposit due...", "Travel": "All travel costs..."}


@dataclass
class AcceptanceBlock:
    client_name: str = ""
    client_company: str = ""
    seller_name: str = ""
    seller_title: str = ""


@dataclass
class BrandTheme:
    """Per-tenant brand configuration for PDF rendering."""
    tenant: str                    # "cc" or "acs"
    logo_path: str                 # absolute path to logo PNG/SVG
    accent_color: tuple = (30, 77, 140)  # RGB tuple — CC: (30,77,140) = #1e4d8c
    company_name: str = ""         # footer display name
    footer_contact: str = ""       # footer one-liner
    confidentiality_note: str = "This quote is confidential. Prices valid for 14 days from issue date."


# ─── Canonical brand configs ─── #

CC_BRAND = BrandTheme(
    tenant="cc",
    logo_path="",  # set at runtime from blaze-data/brand/cc/logos/
    accent_color=(30, 77, 140),   # #1e4d8c — logo navy (on white doc)
    company_name="Content Co-op",
    footer_contact="Content Co-op | 322 Wilcrest Dr. Houston, TX 77042 | bailey@contentco-op.com",
    confidentiality_note="This quote is confidential. Prices valid for 14 days from issue date.",
)

ACS_BRAND = BrandTheme(
    tenant="acs",
    logo_path="",  # set at runtime from blaze-data/brand/acs/logos/
    accent_color=(13, 84, 135),   # #0d5487 — dark Pacific cerulean
    company_name="Astro Cleanings",
    footer_contact="Astro Cleanings | Houston, TX | caio@astrocleanings.com",
    confidentiality_note="This quote is confidential. Prices valid for 7 days from issue date.",
)


@dataclass
class SummaryBlock:
    """The phase summary + grand total page."""
    immediate_note: str = ""       # "Phase 1 Only — $3,400 for March 12 b-roll capture."
    immediate_detail: str = ""     # "Phases 2 & 3 quoted for planning..."
    deposit_note: str = ""         # ACS: "50% deposit required to secure booking"
    payment_methods: str = ""      # ACS: "Zelle, Venmo, Cash"


@dataclass
class QuoteDocumentPayload:
    """
    Canonical document payload for rendering quotes/invoices.
    Both CCO and ACS intake flows normalize into this structure.
    """
    # Identity
    document_type: str = "quote"   # "quote" | "invoice"
    quote_number: int = 0
    ref_name: str = ""             # "SE Customer Story — El Paso"
    issue_date: str = ""           # "March 3, 2026"
    valid_until: str = ""          # "March 17, 2026"

    # Parties
    seller: SellerInfo = field(default_factory=SellerInfo)
    buyer: BuyerInfo = field(default_factory=BuyerInfo)

    # Content
    phases: List[Phase] = field(default_factory=list)
    summary: SummaryBlock = field(default_factory=SummaryBlock)
    terms: TermsBlock = field(default_factory=TermsBlock)
    notes: List[str] = field(default_factory=list)
    acceptance: AcceptanceBlock = field(default_factory=AcceptanceBlock)

    # Branding
    brand: BrandTheme = field(default_factory=lambda: CC_BRAND)

    @property
    def total(self) -> float:
        return sum(phase.subtotal for phase in self.phases)

    @property
    def phase_subtotals(self) -> List[tuple]:
        """Returns [(phase_name, subtotal), ...]"""
        return [(p.name, p.subtotal) for p in self.phases]
