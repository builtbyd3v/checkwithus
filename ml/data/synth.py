"""Synthetic elder-scam and hard-legit SMS. Fake people, fake numbers (555), made-up domains.

Usage: python ml/data/synth.py > ml/data/synthetic.csv
"""
import csv
import random
import re
import sys

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
    return rows


if __name__ == "__main__":
    w = csv.writer(sys.stdout)
    w.writerow(["text", "label", "scam_type", "source"])
    w.writerows(build())
