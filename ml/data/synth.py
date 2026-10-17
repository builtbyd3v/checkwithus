"""Synthetic elder-scam and hard-legit SMS. Fake people, fake numbers (555), made-up domains.

Usage: ml/.venv/bin/python -I ml/data/synth.py  (writes ml/data/synthetic.csv and ml/data/probe.csv)
"""
import csv
import random
import re
from pathlib import Path

R = random.Random(42)
N_PER_SIDE = 200

NAMES = ["Emma", "Jake", "Lily", "Noah", "Sophie", "Ben", "Mia", "Tyler", "Grace", "Ryan"]
GRAN = ["Grandma", "Grandpa", "Nana", "Papa", "Gram"]
BANKS = ["Chase", "Wells Fargo", "Bank of America", "Citi", "Capital One", "PNC", "US Bank"]
CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Amazon"]
CARDS = ["Apple", "Google Play", "Target", "Walmart", "Steam", "eBay"]
TECH = ["Microsoft", "Apple", "Norton", "McAfee", "Geek Squad", "Windows Defender"]
AGENCIES = ["Social Security Administration", "IRS", "Medicare", "Department of Treasury", "Sheriff's Office", "US Marshals"]
CITIES = ["Mexico City", "Toronto", "Miami", "Atlanta", "Cancun", "Phoenix"]
SWEEPS = ["Publishers Clearing House", "Walmart", "Costco", "Mega Millions", "Reader's Digest", "Amazon", "Kroger"]
LOVERS = ["David", "Michael", "Richard", "James", "Robert", "Linda", "Susan", "Karen"]
JOBS = ["an engineer on an oil rig", "a surgeon with the UN", "a US Army captain overseas", "a ship captain at sea", "a contractor in Dubai"]
SCAM_DOMAINS = ["secure-verify-acct.co", "usps-redeliver.info", "help-desk-support.net", "claim-reward-now.top",
                "acct-review-center.com", "pkg-track-update.xyz", "ssa-benefit-check.org", "refund-portal.live"]


def amt():
    return R.choice([49, 89, 199, 299, 450, 500, 750, 980, 1200, 1500, 2500, 3000, 4800])


def phone():
    return f"({R.randint(201, 989)}) 555-{R.randint(100, 199):04d}"


def url():
    return f"https://{R.choice(SCAM_DOMAINS)}/{R.choice(['v', 'r', 'id', 'c'])}{R.randint(1000, 99999)}"


SCAMS = {
    "grandparent": [
        lambda: f"{R.choice(GRAN)} it's me {R.choice(NAMES)}. I got in a car accident and I'm in jail. Please don't tell mom. I need ${amt()} for bail today",
        lambda: f"Hi {R.choice(GRAN)}, new number, I broke my phone. Can you send me ${amt()}? I'll explain later, it's urgent",
        lambda: f"{R.choice(GRAN)} please help, I'm stuck in {R.choice(CITIES)} and they took my wallet. Can you wire ${amt()}? Don't tell anyone please",
        lambda: f"This is Officer Daniels. Your grandson {R.choice(NAMES)} was arrested. Bail is ${amt()}. Call {phone()} and keep this confidential, there is a gag order",
        lambda: f"Hey {R.choice(GRAN)} its {R.choice(NAMES)}, I'm in trouble and need ${amt()} in gift cards right now. Please hurry I'm scared",
        lambda: f"{R.choice(GRAN)}?? It's {R.choice(NAMES)}. Lawyer says I need ${amt()} cash today. A courier will come pick it up at your house. Please don't call dad",
    ],
    "tech_support": [
        lambda: f"{R.choice(TECH)} ALERT: Your computer is infected with 5 viruses. Your bank info is at risk. Call {phone()} immediately. Do not turn off your device",
        lambda: f"{R.choice(TECH)} Security: suspicious login detected from Russia. To protect your account call support at {phone()}",
        lambda: f"Your {R.choice(TECH)} subscription was renewed for ${amt()}.99. If you did not authorize this, call {phone()} to cancel and get a refund",
        lambda: f"WARNING: your iCloud has been hacked. Call {R.choice(TECH)} tech support {phone()} now. We will connect to fix it remotely",
        lambda: f"Hello this is {R.choice(TECH)} support. We refunded you ${amt()} by mistake. Please install AnyDesk so we can fix the error. Call {phone()}",
        lambda: f"{R.choice(TECH)}: Your device license expired and your files will be deleted in 24 hours. Renew at {url()}",
    ],
    "gift_card": [
        lambda: f"Hi it's Pastor Mike, I'm in a meeting and can't talk. I need {R.choice(CARDS)} gift cards for a member in need. Can you buy ${amt()} and text me the codes?",
        lambda: f"To avoid suspension of your benefits, pay the ${amt()} fee with {R.choice(CARDS)} gift cards. Scratch the back and send a photo of the codes",
        lambda: f"Your utility service will be disconnected in 1 hour. Pay ${amt()} now using {R.choice(CARDS)} cards. Call {phone()} with the card numbers",
        lambda: f"Hey, it's your neighbor. Can you do me a quick favor and pick up 4 {R.choice(CARDS)} gift cards of $100 each? I'll pay you back tonight. Send me pictures of the backs",
        lambda: f"{R.choice(AGENCIES)}: Settle your balance of ${amt()} today with {R.choice(CARDS)} gift cards to avoid arrest. Reply YES for instructions",
    ],
    "prize": [
        lambda: f"Congratulations! You won ${R.choice([5000, 25000, 100000, 1500000])} in the {R.choice(SWEEPS)} Sweepstakes. Pay the ${amt()} processing fee to claim: {url()}",
        lambda: f"You have been selected for a free {R.choice(SWEEPS)} gift card worth $1000. Claim within 24 hrs at {url()}",
        lambda: f"WINNER! Your number was drawn in the national lottery. Call {phone()} to release your ${R.choice([50000, 250000, 850000])} prize. Taxes must be paid first",
        lambda: f"{R.choice(SWEEPS)}: dear customer you qualify for a $750 grocery reward for seniors. Confirm your info at {url()}",
        lambda: f"{R.choice(SWEEPS)} final notice: your unclaimed refund of ${amt()} expires today. Enter your bank details at {url()} to receive it",
    ],
    "romance": [
        lambda: f"Good morning my love. I can't stop thinking of you. My contract ends soon but I need ${amt()} for the customs fee to fly to you. Yours, {R.choice(LOVERS)}",
        lambda: f"Hello dear, I am {R.choice(LOVERS)}, {R.choice(JOBS)}. I can't access my money here. Could you help me with ${amt()} until I come home to you?",
        lambda: f"Darling, my bank account is frozen while I'm overseas. Can you send ${amt()} by Western Union? I will pay you back when I land, I promise",
        lambda: f"Hi dear, I'm {R.choice(LOVERS)}, a widowed army doctor stationed abroad. I found your profile and felt a connection. Can we talk on WhatsApp?",
        lambda: f"Sweetheart I made a great profit on crypto, I want to share it with you. Just deposit ${amt()} on this platform and I'll guide you: {url()}",
        lambda: f"My love, the hospital will not release me until the bill of ${amt()} is paid. You are the only one I trust. Please send it today. {R.choice(LOVERS)}",
    ],
    "impostor": [
        lambda: f"{R.choice(AGENCIES)}: Your Social Security number has been suspended due to suspicious activity. Call {phone()} immediately to avoid legal action",
        lambda: f"This is the {R.choice(AGENCIES)}. A warrant has been issued in your name. To clear it, call agent Brooks at {phone()} today",
        lambda: f"{R.choice(['Medicare', 'Medicare Services', 'CMS Benefits', 'Medicare Advantage'])}: your card is expiring. To get a new card verify your Medicare number and bank info at {url()}",
        lambda: f"{R.choice(AGENCIES)} NOTICE: You owe ${amt()} in back taxes or fines. Failure to pay today will result in arrest. Call {phone()}",
        lambda: f"Hello, this is {R.choice(['Amazon', 'PayPal', 'Venmo'])} fraud department. We blocked a ${amt()} charge. To protect your money move it to a safe account. Call {phone()}",
        lambda: f"{R.choice(['Duke Energy', 'FPL', 'Your electric company', 'Gas company'])} here. Your account is past due and a technician will cut power in 30 minutes unless you pay ${amt()}. Call {phone()}",
    ],
    "bank_alert": [
        lambda: f"{R.choice(BANKS)}: Unusual sign-in on your account. If this wasn't you, verify your identity at {url()}",
        lambda: f"{R.choice(BANKS)} ALERT: Your debit card has been locked. Unlock it now: {url()}",
        lambda: f"{R.choice(BANKS)} Fraud Dept: Did you approve a ${amt()}.00 Zelle payment? Reply YES or NO. If NO, we will call you",
        lambda: f"This is {R.choice(BANKS)}. We need you to confirm the code we just sent you so we can stop the fraud. Read it to the agent when we call",
        lambda: f"{R.choice(BANKS)}: Your online access is suspended. Log in to restore: {url()}",
    ],
    "delivery": [
        lambda: f"{R.choice(CARRIERS)}: Your package could not be delivered due to an incomplete address. Update here: {url()}",
        lambda: f"{R.choice(CARRIERS)}: A $1.99 redelivery fee is required for your parcel. Pay within 12 hours: {url()}",
        lambda: f"Your {R.choice(CARRIERS)} package is on hold at our warehouse. Confirm your details to release it: {url()}",
        lambda: f"{R.choice(CARRIERS)} final notice: your shipment will be returned to sender. Reschedule now {url()}",
        lambda: f"{R.choice(CARRIERS)}: We tried to deliver your {R.choice(['parcel', 'package', 'order', 'item'])} but no one was home. Book a new time: {url()}",
        lambda: f"{R.choice(CARRIERS)} customs: your {R.choice(['parcel', 'package', 'order', 'item'])} has an unpaid import fee of $3.{R.randint(10, 99)}. Pay now or it will be destroyed: {url()}",
    ],
}

LEGIT = [
    lambda: f"{R.choice(BANKS)}: A ${amt()}.{R.randint(10, 99)} purchase at {R.choice(['Publix', 'Walgreens', 'Shell', 'Target', 'CVS'])} was made on your card ending {R.randint(1000, 9999)}. No action needed if this was you.",
    lambda: f"{R.choice(BANKS)}: Your one-time code is {R.randint(100000, 999999)}. Never share this code. We will never call you to ask for it.",
    lambda: f"Your verification code is {R.randint(100000, 999999)}. It expires in 10 minutes. Do not share it with anyone.",
    lambda: f"{R.choice(BANKS)}: Your direct deposit of ${R.choice([1432, 1876, 2210, 980])}.00 has posted to your checking account.",
    lambda: f"{R.choice(BANKS)}: Your statement is ready to view in the app. Balance due ${amt()}.{R.randint(10, 99)} by the 25th.",
    lambda: f"Duke Energy: Your bill of ${R.randint(60, 240)}.{R.randint(10, 99)} is ready. It is due on {R.choice(['Nov 3', 'Nov 12', 'Dec 1'])}. Pay in the app or on your mailed statement.",
    lambda: f"City Water Utility: Your autopay of ${R.randint(30, 90)}.{R.randint(10, 99)} was processed. Thank you.",
    lambda: f"Reminder: your appointment with Dr. {R.choice(['Patel', 'Nguyen', 'Smith', 'Garcia'])} is on {R.choice(['Tuesday', 'Thursday', 'Monday'])} at {R.choice(['9', '10', '11'])}:{R.choice(['00', '15', '30'])} AM. Reply C to confirm or call the office to reschedule.",
    lambda: f"CVS Pharmacy: Your prescription is ready for pickup at the {R.choice(['Main St', 'Oak Ave', 'Elm Rd'])} store. It will be held for 7 days.",
    lambda: f"Walgreens: Your refill is ready. Pickup by {R.choice(['Friday', 'Saturday', 'Sunday'])}. Reply STOP to opt out.",
    lambda: f"{R.choice(CARRIERS)}: Your package was delivered to your front door at {R.randint(9, 11)}:{R.randint(10, 59)} AM.",
    lambda: f"{R.choice(CARRIERS)}: Your order is out for delivery today. Track it in the {R.choice(CARRIERS)} app.",
    lambda: f"Your Amazon order of {R.choice(['paper towels', 'reading glasses', 'a phone charger', 'vitamins'])} has shipped and arrives {R.choice(['tomorrow', 'Thursday', 'Saturday'])}.",
    lambda: f"Hi {R.choice(GRAN)}, it's {R.choice(NAMES)}! Can't wait to see you {R.choice(['Sunday', 'this weekend', 'at Thanksgiving'])}. Love you!",
    lambda: f"{R.choice(GRAN)} I got an A on my test! Thanks for helping me study. Call you tonight",
    lambda: f"Hi mom, I sent you the photos from the party. Let me know if you got them. Dinner Sunday still on?",
    lambda: f"Medicare: Your Medicare Summary Notice is now available on Medicare.gov. We will never call or text to ask for your Medicare number.",
    lambda: f"Social Security: Your annual benefit statement is available in your my Social Security account. We will never ask for payment by gift card.",
    lambda: f"{R.choice(BANKS)}: You sent ${R.randint(20, 200)}.00 to {R.choice(NAMES)} {R.choice(['Lee', 'Brown', 'Diaz'])} with Zelle. If you didn't make this payment, call the number on the back of your card.",
    lambda: f"Publix: Your grocery order is ready for curbside pickup. Park in a pickup spot and tap I'm here.",
    lambda: f"Dentist office: Reminder of your cleaning on {R.choice(['Oct 22', 'Nov 5', 'Nov 19'])} at {R.choice([1, 2, 3, 4])} PM. Reply Y to confirm.",
    lambda: f"Comcast: Your payment of ${R.randint(50, 150)}.{R.randint(10, 99)} was received. Thank you for being a customer.",
    lambda: f"Church office: Bible study moves to Wednesday at 6 PM this week. See you there!",
    lambda: f"Your library hold '{R.choice(['The Thursday Murder Club', 'Lessons in Chemistry', 'The Women'])}' is ready for pickup.",
    lambda: f"{R.choice(BANKS)}: Your card ending {R.randint(1000, 9999)} was declined at {R.choice(['Amazon', 'Kroger', 'Exxon'])}. Check the app for details. We will never ask for your PIN.",
]


TOLLS = ["E-ZPass", "SunPass", "FasTrak", "TxTag", "Peach Pass", "The Toll Roads", "Illinois Tollway", "Toll Services"]
ROADS = ["I-95", "the Turnpike", "SR-408", "I-90", "Route 1", "the Parkway"]
TOLL_DOMAINS = ["ezpass-tollpay.com", "toll-service-billing.xyz", "sunpass-pay.info", "tollroads-notice.top"]
PERSONAS = ["Jessica", "Amy Chen", "Vivian", "Lisa Wong", "Kevin", "Mark Liu", "Sophia"]
PLACES = ["wine tasting", "church picnic", "yoga class", "golf club", "community center"]


def toll_amt():
    return R.choice(["3.75", "4.15", "5.80", "6.99", "11.69", "12.51"])


def toll_url():
    return f"https://{R.choice(TOLL_DOMAINS)}/{R.choice(['pay', 'bill', 'v'])}{R.randint(1000, 99999)}"


# Made-up trading platforms. The probe uses its own names so the model cannot match on the name.
PLATFORMS = ["Aurex Trade", "Kinvaro", "BlueHarbor FX", "Zentrix Coin"]
PROBE_PLATFORMS = ["Lumacoin", "VeraTradex", "OrbitFX Pro"]


def pct():
    return R.choice([6, 9, 12, 15, 20, 35])


def profit():
    return R.choice([14800, 23500, 41200, 88000])


# Toll scams count as "delivery": same pattern (small fee + link + urgency), and the task folds them together.
EXTRA_SCAMS = {
    "delivery": [
        lambda: f"{R.choice(TOLLS)}: You have an unpaid toll balance of ${toll_amt()}. Pay now to avoid a ${R.choice([25, 50, 75])} late fee: {toll_url()}",
        lambda: f"{R.choice(TOLLS)} final notice: outstanding toll of ${toll_amt()} on your vehicle. Pay today or your license may be suspended: {toll_url()}",
        lambda: f"Your {R.choice(TOLLS)} account has an unpaid toll. Settle ${toll_amt()} within 24 hours at {toll_url()}",
        lambda: f"{R.choice(TOLLS)}: We noticed an unpaid toll charge. Reply Y, then reopen this message to activate the link: {toll_url()}",
        lambda: f"Toll notice: ${toll_amt()} due for travel on {R.choice(ROADS)}. Pay immediately to avoid fines: {toll_url()}",
    ],
    # Pitch and fee stages only. "Wrong number" openers are left out: alone they read like a real wrong number,
    # so training them as scams teaches false holds (DECISIONS 29).
    "investment": [
        lambda: f"My uncle is an analyst and showed me a crypto trick. I made ${R.choice([3200, 8500, 12000, 26000])} this week. I can teach you, just open an account at {url()}",
        lambda: f"Guaranteed {R.choice([12, 18, 25, 30])}% weekly returns with our Bitcoin trading signals. Join our private group: {url()}",
        lambda: f"Your crypto account shows ${R.choice([18400, 42000, 96500])} profit. To withdraw you must first pay a ${amt()} tax fee.",
        lambda: f"Exclusive offer for retirees: double your savings with gold and crypto. Call {phone()} today, limited spots.",
        lambda: f"{R.choice(PERSONAS)} here. The platform I told you about is up {R.choice([8, 14, 22])}% today. Deposit ${amt()} USDT to start: {url()}",
        lambda: f"{R.choice(PERSONAS)}: my mentor's AI trading bot made {pct()}% this month. I can open a spot for you, minimum ${amt()}: {url()}",
        lambda: f"Hello friend, gold futures are moving tonight. Transfer ${amt()} to your trading account now and follow my signals.",
        lambda: f"Professor {R.choice(PERSONAS)}'s stock group has free spots today. Join and get 3 daily picks: {url()}",
        lambda: f"Your {R.choice(PLATFORMS)} account has ${profit()} available. Pay the ${amt()} unlock fee to withdraw.",
        lambda: f"Withdrawal blocked: your profit of ${profit()} needs a {pct()}% tax paid first. Contact customer service.",
        lambda: f"I know you're nervous, but I doubled my money twice on {R.choice(PLATFORMS)}. Try ${amt()} first, you can withdraw anytime.",
        lambda: f"Liquidity mining pays {pct()}% a day. Connect your wallet here and start earning: {url()}",
        lambda: f"Exclusive pre-IPO shares at a discount for our members. Wire ${amt()} today to reserve your allocation.",
        lambda: f"Your {R.choice(PLATFORMS)} credit score is too low to withdraw. Deposit ${amt()} more to raise it.",
        lambda: f"Good morning dear, did you buy the coin I told you about? It's up {pct()}% already, still time: {url()}",
        lambda: f"Hi, I'm {R.choice(PERSONAS)}'s assistant. You were selected for our wealth mentorship, earn {pct()}% weekly. Reply 1 to start.",
        lambda: f"{R.choice(PLATFORMS)} support: your account will be frozen unless you top up ${amt()} within 24 hours.",
    ],
}
EXTRA_N = {"delivery": 20, "investment": 40}

TOLL_LEGIT = [
    lambda: f"{R.choice(TOLLS)}: Your account was replenished with ${R.choice([10, 20, 25, 35])}.00 from your card on file. No action needed.",
    lambda: f"{(t := R.choice(TOLLS))}: Your monthly statement is ready. Sign in to the {t} app or the website on your card to view it.",
    lambda: f"{R.choice(TOLLS)}: The transponder for your vehicle ending {R.randint(100, 999)} is active. Thank you for driving with us.",
    lambda: f"Thanks for calling {R.choice(['Publix', 'Walgreens', 'your pharmacy', 'Medicare'])}. Our toll-free number is 1-800-555-{R.randint(100, 199):04d}. Hours are 8 to 6.",
]
TOLL_LEGIT_N = 10

# Brokerage alerts, money talk and real wrong numbers, so the model learns investment words are not scams by themselves.
INVEST_LEGIT = [
    lambda: f"Schwab: Your trade confirmation for {R.choice([5, 10, 20])} shares of VTI is available in your account.",
    lambda: f"E*TRADE: A deposit of ${amt()}.00 has posted to your brokerage account.",
    lambda: f"Merrill: Your required minimum distribution of ${amt()} was sent to your checking account.",
    lambda: f"Mom, I finally opened a Roth IRA! Put in ${R.choice([100, 250, 500])} to start.",
    lambda: f"Reminder: your appointment with {R.choice(PERSONAS)} at Edward Jones is Thursday at 11 AM. Reply C to confirm.",
    lambda: f"Your 401(k) contribution of {pct()}% starts with your next paycheck.",
    lambda: f"Sorry, wrong number, I meant to text my {R.choice(['landlord', 'brother', 'neighbor', 'coach'])}!",
    lambda: "Oops, wrong person, sorry about that!",
    lambda: "Who is this? I don't have this number saved.",
    lambda: f"Hi it's {R.choice(PERSONAS)}, new number! Save this one, my old phone died.",
    lambda: f"Stocks were wild today. Glad I didn't sell, {R.choice(NAMES)}.",
    lambda: f"Investment club meets at the library {R.choice(['Monday', 'Wednesday'])} at 6. Bring your questions about bonds!",
]
INVEST_LEGIT_N = 30

# Probe set: held-out templates, never in train/val/test. Measures toll and investment recall, since no real texts exist.
# Investment is split by stage: the opener is reported but not targeted, the pitch and fee stages are the target.
PROBE = [
    (("scam", "delivery"), [
        lambda: f"NOTICE from {R.choice(TOLLS)}: toll invoice #{R.randint(10000, 99999)} for ${toll_amt()} is past due. Avoid collections by paying at {toll_url()}",
        lambda: f"{R.choice(TOLLS)} Billing: a payment of ${toll_amt()} failed. Update your card at {toll_url()} to keep your account open.",
        lambda: f"State Toll Authority: unpaid tolls on your plate. ${toll_amt()} plus fees due tonight. {toll_url()}",
    ], 15),
    (("scam", "investment_opener"), [
        lambda: f"Hey, sorry, I think I texted the wrong person. I'm {R.choice(PERSONAS)}, nice to meet you anyway :)",
        lambda: f"Is this Dr. {R.choice(NAMES)}'s office? I need to move my cleaning to next week.",
        lambda: f"Hi {R.choice(NAMES)}, it's been ages! Are you still living in {R.choice(CITIES)}?",
        lambda: f"Good morning! Is the dog sitting still on for this weekend? - {R.choice(PERSONAS)}",
        lambda: f"Hello, {R.choice(PERSONAS)} gave me your number. Are you the one selling the piano?",
    ], 10),
    (("scam", "investment_pitch"), [
        lambda: f"Hi {R.choice(NAMES)}, it's {R.choice(PERSONAS)} from the {R.choice(PLACES)}. Did you get a chance to look at the trading app I mentioned?",
        lambda: f"Earn ${R.choice([4000, 6500, 9000])} a month from home with AI crypto arbitrage. No experience needed. Start: {url()}",
        lambda: f"Your wallet bonus of {R.choice(['0.15', '0.3', '0.5'])} BTC is waiting. Pay the ${amt()} activation fee to unlock it.",
        lambda: f"My aunt works at a hedge fund and shares gold contract signals every morning. Last month I made ${profit()}. Want me to add you to the group?",
        lambda: f"{R.choice(PERSONAS)} here :) I just closed my position, +{pct()}% today. Download {R.choice(PROBE_PLATFORMS)} and I'll walk you through your first trade.",
        lambda: f"Congratulations, your {R.choice(PROBE_PLATFORMS)} account earned ${profit()}. Before withdrawal a security deposit of ${amt()} is required.",
        lambda: f"Your withdrawal of ${profit()} is on hold for a tax review. Pay ${amt()} to release the funds.",
        lambda: f"Hi dear, the mining pool is paying {pct()}% daily interest this week. Start with just ${amt()}, I will help you set it up.",
        lambda: f"I made a small test deposit for you on {R.choice(PROBE_PLATFORMS)}. Log in with code {R.randint(1000, 9999)} and see the profit yourself: {url()}",
        lambda: f"Our VIP members are seeing steady {pct()}% monthly returns on AI stock picks. Reply YES and our analyst will message you on WhatsApp.",
        lambda: f"Did you open the account yet? The signal closes at 9 PM tonight, deposit at least ${amt()} so you don't miss it.",
    ], 30),
    (("legit", "none"), [
        lambda: f"{R.choice(TOLLS)}: Thanks for your payment of ${toll_amt()}. Your balance is now $0.00.",
        lambda: f"{R.choice(TOLLS)}: Low balance alert. Auto-replenish will add ${R.choice([10, 20])} from your card on file tonight.",
        lambda: f"Questions about your order? Call our toll-free customer line at 1-800-555-{R.randint(100, 199):04d}.",
    ], 10),
    (("legit", "none"), [
        lambda: f"Fidelity: Your deposit of ${amt()}.00 to your brokerage account is complete.",
        lambda: f"Robinhood: Your order to buy {R.choice([1, 2, 5])} shares of AAPL was filled.",
        lambda: "Vanguard: Your quarterly statement is ready. Log in to the website or app to view it.",
        lambda: "Fidelity: We will never ask you to send crypto or pay a fee to withdraw your money.",
        lambda: f"Your advisor {R.choice(PERSONAS)} scheduled a portfolio review for Tuesday at 2 PM. Reply C to confirm.",
        lambda: f"Dad, I put ${R.choice([200, 300])} into an index fund like you said. Thanks for the tip!",
        lambda: "Sorry, wrong number! I was trying to reach my sister.",
        lambda: f"Hi, is this {R.choice(NAMES)}? It's {R.choice(PERSONAS)} from book club, I got a new phone.",
        lambda: "Did you see the market today? My 401k is down 3% lol",
        lambda: f"Your pension deposit of ${amt()} will arrive on the 1st.",
    ], 20),
]
PROBE_SEED = 7  # the probe has its own seed, so adding training rows does not change it


def key(text):
    # Same idea as build.norm: rows that differ only in digits or links are one row.
    s = re.sub(r"\W+", " ", re.sub(r"https?://\S+|\d+", " ", text.lower())).strip()
    return s[:60] + "|" + s[-40:]


def build():
    rows, seen = [], set()
    types = list(SCAMS)
    while len([r for r in rows if r[1] == "scam"]) < N_PER_SIDE:
        t = types[len(rows) % len(types)]
        text = R.choice(SCAMS[t])()
        if key(text) not in seen:
            seen.add(key(text))
            rows.append((text, "scam", t, "synthetic"))
    n = len(rows)
    while len(rows) - n < N_PER_SIDE:
        text = R.choice(LEGIT)()
        if key(text) not in seen:
            seen.add(key(text))
            rows.append((text, "legit", "none", "synthetic"))
    # Added after the original 400 so those rows stay byte-identical.
    groups = [(("scam", t), fs, EXTRA_N[t]) for t, fs in EXTRA_SCAMS.items()] + [(("legit", "none"), TOLL_LEGIT, TOLL_LEGIT_N),
                                                                               (("legit", "none"), INVEST_LEGIT, INVEST_LEGIT_N)]
    rows += fill(groups, seen, "synthetic")
    return rows


def fill(groups, seen, source):
    out = []
    for (label, t), fs, n in groups:
        got = 0
        while got < n:
            text = R.choice(fs)()
            if key(text) not in seen:
                seen.add(key(text))
                out.append((text, label, t, source))
                got += 1
    return out


def write(path, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["text", "label", "scam_type", "source"])
        w.writerows(rows)


if __name__ == "__main__":
    out = Path(__file__).resolve().parent
    rows = build()
    write(out / "synthetic.csv", rows)
    R.seed(PROBE_SEED)
    write(out / "probe.csv", fill(PROBE, {key(r[0]) for r in rows}, "probe"))
