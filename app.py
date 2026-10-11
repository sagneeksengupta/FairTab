from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 256 * 1024

CENT = Decimal("0.01")


def money(value, field):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"{field} must be a valid number.")
    if not amount.is_finite() or amount < 0:
        raise ValueError(f"{field} cannot be negative.")
    return amount


def rounded(value):
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@app.post("/api/split")
def split_bill():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify(error="Send bill details as a JSON object."), 400
    people = payload.get("people")
    items = payload.get("items")
    if not isinstance(people, list) or not people:
        return jsonify(error="Add at least one person to split the bill."), 400
    if not isinstance(items, list) or not items:
        return jsonify(error="Add at least one item to calculate the split."), 400
    if len(people) > 100 or len(items) > 500:
        return jsonify(error="A bill can include up to 100 people and 500 items."), 400

    names = []
    for person in people:
        name = str(person).strip()[:48]
        if name and name not in names:
            names.append(name)
    if not names:
        return jsonify(error="Add a name for at least one person."), 400
    if len(names) != len([str(person).strip() for person in people if str(person).strip()]):
        return jsonify(error="Each person needs a unique name."), 400

    try:
        gst_rate = money(payload.get("gstRate", 0), "GST rate")
        if gst_rate > 100:
            raise ValueError("GST rate cannot exceed 100%.")

        totals = {name: Decimal("0") for name in names}
        item_results = []
        subtotal = Decimal("0")
        total_gst = Decimal("0")
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                raise ValueError(f"Item {index + 1} is invalid.")
            label = str(item.get("name", "")).strip()[:80] or f"Item {index + 1}"
            quantity = money(item.get("quantity", 1), f"{label} quantity")
            if quantity <= 0 or quantity > 10000:
                raise ValueError(f"{label} quantity must be greater than 0 and at most 10,000.")
            price = money(item.get("price", 0), f"{label} price")
            if price > Decimal("100000000"):
                raise ValueError(f"{label} price is too large.")
            assigned = item.get("assignedTo")
            if not isinstance(assigned, list):
                assigned = []
            assigned = list(dict.fromkeys(str(name) for name in assigned if str(name) in names))
            if not assigned:
                raise ValueError(f"Choose who ordered {label}.")
            line_subtotal = price * quantity
            line_tax = rounded(line_subtotal * gst_rate / 100)
            line_total = rounded(line_subtotal) + line_tax
            subtotal += rounded(line_subtotal)
            total_gst += line_tax
            # Split cents deterministically so each line's shares add back to its total.
            participants = len(assigned)
            per_person_cents = int((line_total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            base, remainder = divmod(per_person_cents, participants)
            shares = {}
            for position, name in enumerate(assigned):
                share = Decimal(base + (1 if position < remainder else 0)) / 100
                totals[name] += share
                shares[name] = str(rounded(share))
            item_results.append({
                "name": label,
                "quantity": str(quantity.normalize()),
                "unitPrice": str(rounded(price)),
                "subtotal": str(rounded(line_subtotal)),
                "gst": str(line_tax),
                "total": str(line_total),
                "assignedTo": assigned,
                "shares": shares,
            })

        grand_total = sum((Decimal(row["total"]) for row in item_results), Decimal("0"))
        return jsonify(
            people=[{"name": name, "total": str(rounded(totals[name]))} for name in names],
            items=item_results,
            subtotal=str(rounded(subtotal)),
            gst=str(rounded(total_gst)),
            total=str(rounded(grand_total)),
            gstRate=str(gst_rate),
        )
    except ValueError as error:
        return jsonify(error=str(error)), 400


@app.get("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run()
