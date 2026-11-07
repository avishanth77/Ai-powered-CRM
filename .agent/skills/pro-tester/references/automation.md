# Test Automation

## Principles
Test pyramid: many unit, fewer API/integration, few E2E. Automate stable, repeated, high-value checks. Keep tests independent, deterministic, readable (Arrange-Act-Assert), and fast. Use fixtures/factories for data. No fixed sleeps.

## Django / DRF (pytest-django)
```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture
def user(db):
    return User.objects.create_user(username="qa", password="Passw0rd!")

@pytest.mark.django_db
def test_list_requires_auth(client):
    assert client.get("/api/items/").status_code == 401

@pytest.mark.django_db
def test_create_item_valid(client, user):
    client.force_authenticate(user)
    r = client.post("/api/items/", {"name": "Pen", "price": "9.99"}, format="json")
    assert r.status_code == 201
    assert r.json()["name"] == "Pen"

@pytest.mark.django_db
@pytest.mark.parametrize("payload", [{}, {"name": ""}, {"name": "x", "price": "-1"}])
def test_create_item_invalid(client, user, payload):
    client.force_authenticate(user)
    assert client.post("/api/items/", payload, format="json").status_code == 400
```

## Playwright (Python) E2E
```python
from playwright.sync_api import Page, expect

def test_login_success(page: Page):
    page.goto("http://localhost:3000/login")
    page.get_by_label("Email").fill("qa@example.com")
    page.get_by_label("Password").fill("Passw0rd!")
    page.get_by_role("button", name="Sign in").click()
    expect(page).to_have_url("http://localhost:3000/dashboard")
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible()
```

## React (Jest + Testing Library)
```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "./LoginForm";

test("shows error on empty submit", async () => {
  render(<LoginForm />);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
});
```

## Selenium rule of thumb
Use `WebDriverWait` + `expected_conditions`; Page Object Model for >3 tests on a page.

## CI
Run unit+API on every push; E2E smoke on PR; full regression nightly. Fail the build on test failure; publish reports (JUnit XML / HTML) and screenshots/traces on failure. Quarantine and fix flaky tests, don't ignore them.
