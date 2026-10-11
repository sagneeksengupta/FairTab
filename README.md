# FairTab

A responsive Flask bill splitter. Add people, list bill items and quantities, assign one or more people to each item, and calculate each person's share including GST.

## Run locally

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
flask --app app run
```

Open http://127.0.0.1:5000. For a production process, the included `Procfile` runs the app with Gunicorn (`gunicorn app:app`). Configure the hosting provider to install `requirements.txt`.

## Calculation

GST is calculated per item and rounded to the nearest minor currency unit. An item's post-GST amount is divided equally among its selected people; any leftover cent is assigned in the order people were selected. The person totals therefore add up exactly to the displayed bill total.

The app does not store bill data. Currency selection changes the display symbol and number formatting; it does not convert amounts or change their underlying value.
