"""
Integration tests for the Inigma Python backend.

Requires Docker — the backend is started via docker-compose (see conftest.py).
Run with: pytest tests/ -v
"""

import uuid


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_secret(http_client, crypto_client, *, ttl=30, custom_name="", plaintext=None):
    """Create an encrypted secret via the API. Returns (view_id, password, creator_uid, plaintext)."""
    password = crypto_client.generate_symmetric_key()
    creator_key = crypto_client.generate_symmetric_key()
    creator_uid = crypto_client.generate_uid(creator_key)

    if plaintext is None:
        plaintext = f"secret-{uuid.uuid4()}"

    encrypted, iv, salt = crypto_client.encrypt(plaintext, password)

    resp = http_client.post("/api/create", json={
        "encrypted_message": encrypted,
        "iv": iv,
        "salt": salt,
        "ttl": ttl,
        "custom_name": custom_name,
        "creator_uid": creator_uid,
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "view" in data

    return data["view"], password, creator_uid, plaintext


def _view_secret(http_client, view_id, uid="anonymous"):
    """Retrieve an encrypted secret via the API.

    The backend requires a non-empty uid even for unclaimed secrets.
    When the DB record has uid='', any valid uid is granted access.
    """
    resp = http_client.post("/api/view", json={"view": view_id, "uid": uid})
    return resp


def _claim_secret(http_client, crypto_client, view_id, owner_uid, plaintext, owner_password):
    """Claim (take ownership of) a secret: re-encrypt with owner's password and update."""
    encrypted, iv, salt = crypto_client.encrypt(plaintext, owner_password)
    resp = http_client.post("/api/update", json={
        "view": view_id,
        "uid": owner_uid,
        "encrypted_message": encrypted,
        "iv": iv,
        "salt": salt,
    })
    return resp


# ---------------------------------------------------------------------------
# A. Health Check
# ---------------------------------------------------------------------------

class TestHealth:
    def test_health(self, http_client):
        resp = http_client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "healthy"}


# ---------------------------------------------------------------------------
# B. Create & View (no ownership)
# ---------------------------------------------------------------------------

class TestCreateAndView:
    def test_create_and_view_default_ttl(self, http_client, crypto_client):
        view_id, password, _, plaintext = _create_secret(http_client, crypto_client, ttl=30)

        resp = _view_secret(http_client, view_id)
        assert resp.status_code == 200

        data = resp.json()
        decrypted = crypto_client.decrypt(
            data["encrypted_message"], data["iv"], data["salt"], password
        )
        assert decrypted == plaintext

    def test_create_and_view_custom_ttl(self, http_client, crypto_client):
        view_id, password, _, plaintext = _create_secret(http_client, crypto_client, ttl=7)

        resp = _view_secret(http_client, view_id)
        assert resp.status_code == 200

        data = resp.json()
        decrypted = crypto_client.decrypt(
            data["encrypted_message"], data["iv"], data["salt"], password
        )
        assert decrypted == plaintext

    def test_create_permanent(self, http_client, crypto_client):
        view_id, password, _, plaintext = _create_secret(http_client, crypto_client, ttl=0)

        resp = _view_secret(http_client, view_id)
        assert resp.status_code == 200

        data = resp.json()
        decrypted = crypto_client.decrypt(
            data["encrypted_message"], data["iv"], data["salt"], password
        )
        assert decrypted == plaintext

    def test_multiple_reads_ttl_secret(self, http_client, crypto_client):
        """Secret with TTL=1 is not destroyed on read — multiple reads return same data."""
        view_id, password, _, plaintext = _create_secret(http_client, crypto_client, ttl=1)

        for i in range(3):
            resp = _view_secret(http_client, view_id)
            assert resp.status_code == 200, f"Read #{i+1} failed"
            data = resp.json()
            decrypted = crypto_client.decrypt(
                data["encrypted_message"], data["iv"], data["salt"], password
            )
            assert decrypted == plaintext

    def test_ttl_days_remaining_in_list(self, http_client, crypto_client):
        """TTL stored correctly — days_remaining in list matches the TTL we set."""
        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        # Permanent secret (TTL=0)
        view_perm, _, _, pt_perm = _create_secret(http_client, crypto_client, ttl=0)
        _claim_secret(http_client, crypto_client, view_perm, owner_uid, pt_perm, owner_password)

        # Short-lived secret (TTL=1 day)
        view_short, _, _, pt_short = _create_secret(http_client, crypto_client, ttl=1)
        _claim_secret(http_client, crypto_client, view_short, owner_uid, pt_short, owner_password)

        resp = http_client.post("/api/list-secrets", json={"uid": owner_uid})
        assert resp.status_code == 200
        secrets = {s["id"]: s for s in resp.json()["secrets"]}

        perm = secrets[view_perm]
        assert perm["days_remaining"] == -1
        assert perm["time_remaining_type"] == "permanent"

        short = secrets[view_short]
        assert short["days_remaining"] >= 0
        assert short["time_remaining_type"] in ("days", "hours", "minutes")

    def test_default_custom_name_is_empty(self, http_client, crypto_client):
        """Secret created without custom_name should have empty string."""
        view_id, _, _, _ = _create_secret(http_client, crypto_client)
        resp = _view_secret(http_client, view_id)
        assert resp.status_code == 200
        assert resp.json()["custom_name"] == ""

    def test_unicode_plaintext(self, http_client, crypto_client):
        """Encrypt/decrypt round-trip works with unicode: accents, greek, emoji, CJK."""
        plaintext = "Grüße! 🔐 こんにちは 中文 Ωμέγα café"
        view_id, password, _, _ = _create_secret(
            http_client, crypto_client, plaintext=plaintext
        )

        resp = _view_secret(http_client, view_id)
        assert resp.status_code == 200
        data = resp.json()
        decrypted = crypto_client.decrypt(
            data["encrypted_message"], data["iv"], data["salt"], password
        )
        assert decrypted == plaintext

    def test_create_with_custom_name(self, http_client, crypto_client):
        name = f"my-secret-{uuid.uuid4().hex[:8]}"
        view_id, _, creator_uid, _ = _create_secret(
            http_client, crypto_client, custom_name=name
        )

        # Verify custom_name is returned in view
        resp = _view_secret(http_client, view_id)
        assert resp.status_code == 200
        assert resp.json()["custom_name"] == name

        # Verify it shows up in pending list
        resp = http_client.post("/api/list-pending-secrets", json={
            "uid": creator_uid,
        })
        assert resp.status_code == 200
        secrets = resp.json()["secrets"]
        ids = [s["id"] for s in secrets]
        assert view_id in ids


# ---------------------------------------------------------------------------
# C. Ownership Flow
# ---------------------------------------------------------------------------

class TestOwnership:
    def test_claim_ownership(self, http_client, crypto_client):
        view_id, password, creator_uid, plaintext = _create_secret(
            http_client, crypto_client
        )

        # Before claiming — is_owner should be false
        resp = _view_secret(http_client, view_id, uid=creator_uid)
        assert resp.status_code == 200
        assert resp.json()["is_owner"] is False

        # Claim it
        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        claim_resp = _claim_secret(
            http_client, crypto_client, view_id, owner_uid, plaintext, owner_password
        )
        assert claim_resp.status_code == 200
        assert claim_resp.json()["status"] == "success"

        # After claiming — is_owner should be true
        resp = _view_secret(http_client, view_id, uid=owner_uid)
        assert resp.status_code == 200
        assert resp.json()["is_owner"] is True

    def test_double_claim_fails(self, http_client, crypto_client):
        view_id, _, _, plaintext = _create_secret(http_client, crypto_client)

        # User A claims
        key_a = crypto_client.generate_symmetric_key()
        uid_a = crypto_client.generate_uid(key_a)
        pw_a = crypto_client.generate_symmetric_key()
        resp_a = _claim_secret(http_client, crypto_client, view_id, uid_a, plaintext, pw_a)
        assert resp_a.status_code == 200

        # User B tries to claim — should get 409
        key_b = crypto_client.generate_symmetric_key()
        uid_b = crypto_client.generate_uid(key_b)
        pw_b = crypto_client.generate_symmetric_key()
        resp_b = _claim_secret(http_client, crypto_client, view_id, uid_b, plaintext, pw_b)
        assert resp_b.status_code == 409
        assert resp_b.json()["status"] == "failed"

    def test_full_sender_recipient_flow(self, http_client, crypto_client):
        """Full flow: sender creates → recipient views & claims → sender loses access."""
        # Sender creates a secret
        view_id, password, sender_uid, plaintext = _create_secret(http_client, crypto_client)

        # Recipient opens the link (unclaimed — anyone with valid uid can view)
        resp = _view_secret(http_client, view_id)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_owner"] is False
        decrypted = crypto_client.decrypt(
            data["encrypted_message"], data["iv"], data["salt"], password
        )
        assert decrypted == plaintext

        # Recipient claims the secret
        recipient_key = crypto_client.generate_symmetric_key()
        recipient_uid = crypto_client.generate_uid(recipient_key)
        recipient_password = crypto_client.generate_symmetric_key()
        claim_resp = _claim_secret(
            http_client, crypto_client, view_id, recipient_uid, plaintext, recipient_password
        )
        assert claim_resp.status_code == 200

        # Recipient can still view
        resp = _view_secret(http_client, view_id, uid=recipient_uid)
        assert resp.status_code == 200
        assert resp.json()["is_owner"] is True

        # Sender can no longer view (different uid, not the owner)
        resp = _view_secret(http_client, view_id, uid=sender_uid)
        assert resp.status_code == 403

    def test_owner_multiple_reads(self, http_client, crypto_client):
        """Owner can read their claimed secret multiple times."""
        view_id, _, _, plaintext = _create_secret(http_client, crypto_client)

        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()
        _claim_secret(http_client, crypto_client, view_id, owner_uid, plaintext, owner_password)

        for i in range(3):
            resp = _view_secret(http_client, view_id, uid=owner_uid)
            assert resp.status_code == 200, f"Owner read #{i+1} failed"
            data = resp.json()
            decrypted = crypto_client.decrypt(
                data["encrypted_message"], data["iv"], data["salt"], owner_password
            )
            assert decrypted == plaintext

    def test_owner_can_view(self, http_client, crypto_client):
        view_id, _, _, plaintext = _create_secret(http_client, crypto_client)

        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        _claim_secret(http_client, crypto_client, view_id, owner_uid, plaintext, owner_password)

        # Owner can view and decrypt
        resp = _view_secret(http_client, view_id, uid=owner_uid)
        assert resp.status_code == 200
        data = resp.json()
        decrypted = crypto_client.decrypt(
            data["encrypted_message"], data["iv"], data["salt"], owner_password
        )
        assert decrypted == plaintext


# ---------------------------------------------------------------------------
# D. List & Pagination
# ---------------------------------------------------------------------------

class TestListAndPagination:
    def test_list_owned_secrets(self, http_client, crypto_client):
        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        for _ in range(3):
            view_id, _, _, plaintext = _create_secret(http_client, crypto_client)
            _claim_secret(
                http_client, crypto_client, view_id, owner_uid, plaintext, owner_password
            )

        resp = http_client.post("/api/list-secrets", json={"uid": owner_uid})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 3

    def test_list_pending_secrets(self, http_client, crypto_client):
        creator_key = crypto_client.generate_symmetric_key()
        creator_uid = crypto_client.generate_uid(creator_key)

        created_ids = []
        for _ in range(3):
            password = crypto_client.generate_symmetric_key()
            plaintext = f"pending-{uuid.uuid4()}"
            encrypted, iv, salt = crypto_client.encrypt(plaintext, password)
            resp = http_client.post("/api/create", json={
                "encrypted_message": encrypted,
                "iv": iv,
                "salt": salt,
                "ttl": 30,
                "creator_uid": creator_uid,
            })
            assert resp.status_code == 200
            created_ids.append(resp.json()["view"])

        resp = http_client.post("/api/list-pending-secrets", json={"uid": creator_uid})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 3
        returned_ids = [s["id"] for s in data["secrets"]]
        for cid in created_ids:
            assert cid in returned_ids

    def test_pagination(self, http_client, crypto_client):
        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        for _ in range(15):
            view_id, _, _, plaintext = _create_secret(http_client, crypto_client)
            _claim_secret(
                http_client, crypto_client, view_id, owner_uid, plaintext, owner_password
            )

        # Page 1
        resp = http_client.post("/api/list-secrets", json={
            "uid": owner_uid, "page": 1, "per_page": 5,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["secrets"]) == 5
        assert data["has_more"] is True

        # Page 2
        resp = http_client.post("/api/list-secrets", json={
            "uid": owner_uid, "page": 2, "per_page": 5,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["secrets"]) == 5


# ---------------------------------------------------------------------------
# E. Delete
# ---------------------------------------------------------------------------

class TestDelete:
    def test_delete_owned_secret(self, http_client, crypto_client):
        view_id, _, _, plaintext = _create_secret(http_client, crypto_client)

        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        _claim_secret(http_client, crypto_client, view_id, owner_uid, plaintext, owner_password)

        # Delete
        resp = http_client.post("/api/delete-secret", json={
            "view": view_id, "uid": owner_uid,
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

        # View should return 404
        resp = _view_secret(http_client, view_id, uid=owner_uid)
        assert resp.status_code == 404

    def test_delete_pending_secret(self, http_client, crypto_client):
        view_id, _, creator_uid, _ = _create_secret(http_client, crypto_client)

        # Creator deletes unclaimed secret
        resp = http_client.post("/api/delete-secret", json={
            "view": view_id, "uid": creator_uid,
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

        # View should return 404
        resp = _view_secret(http_client, view_id, uid=creator_uid)
        assert resp.status_code == 404

    def test_delete_wrong_user_fails(self, http_client, crypto_client):
        view_id, _, _, plaintext = _create_secret(http_client, crypto_client)

        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        _claim_secret(http_client, crypto_client, view_id, owner_uid, plaintext, owner_password)

        # Other user tries to delete
        other_key = crypto_client.generate_symmetric_key()
        other_uid = crypto_client.generate_uid(other_key)

        resp = http_client.post("/api/delete-secret", json={
            "view": view_id, "uid": other_uid,
        })
        assert resp.status_code == 404
        assert resp.json()["status"] == "failed"


# ---------------------------------------------------------------------------
# F. Update Custom Name
# ---------------------------------------------------------------------------

class TestUpdateCustomName:
    def test_update_custom_name(self, http_client, crypto_client):
        view_id, _, _, plaintext = _create_secret(
            http_client, crypto_client, custom_name="original-name"
        )

        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        _claim_secret(http_client, crypto_client, view_id, owner_uid, plaintext, owner_password)

        new_name = f"updated-{uuid.uuid4().hex[:8]}"
        resp = http_client.post("/api/update-custom-name", json={
            "view": view_id, "uid": owner_uid, "custom_name": new_name,
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

        # Verify via list
        resp = http_client.post("/api/list-secrets", json={"uid": owner_uid})
        assert resp.status_code == 200
        secrets = resp.json()["secrets"]
        match = [s for s in secrets if s["id"] == view_id]
        assert len(match) == 1
        assert match[0]["custom_name"] == new_name

    def test_update_name_wrong_user_fails(self, http_client, crypto_client):
        view_id, _, _, plaintext = _create_secret(http_client, crypto_client)

        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        _claim_secret(http_client, crypto_client, view_id, owner_uid, plaintext, owner_password)

        # Other user tries to update name
        other_key = crypto_client.generate_symmetric_key()
        other_uid = crypto_client.generate_uid(other_key)

        resp = http_client.post("/api/update-custom-name", json={
            "view": view_id, "uid": other_uid, "custom_name": "hacked",
        })
        assert resp.status_code == 404
        assert resp.json()["status"] == "failed"


# ---------------------------------------------------------------------------
# G. Idempotency
# ---------------------------------------------------------------------------

class TestIdempotency:
    def test_idempotent_create(self, http_client, crypto_client):
        password = crypto_client.generate_symmetric_key()
        creator_key = crypto_client.generate_symmetric_key()
        creator_uid = crypto_client.generate_uid(creator_key)
        plaintext = f"idem-{uuid.uuid4()}"
        encrypted, iv, salt = crypto_client.encrypt(plaintext, password)
        idempotency_key = uuid.uuid4().hex

        payload = {
            "encrypted_message": encrypted,
            "iv": iv,
            "salt": salt,
            "ttl": 30,
            "creator_uid": creator_uid,
            "idempotency_key": idempotency_key,
        }

        resp1 = http_client.post("/api/create", json=payload)
        assert resp1.status_code == 200
        view1 = resp1.json()["view"]

        resp2 = http_client.post("/api/create", json=payload)
        assert resp2.status_code == 200
        view2 = resp2.json()["view"]

        assert view1 == view2


# ---------------------------------------------------------------------------
# H. Validation & Error Cases
# ---------------------------------------------------------------------------

class TestValidation:
    def test_invalid_base64(self, http_client, crypto_client):
        creator_key = crypto_client.generate_symmetric_key()
        creator_uid = crypto_client.generate_uid(creator_key)

        resp = http_client.post("/api/create", json={
            "encrypted_message": "not-valid-base64!!!@@@",
            "iv": "also-bad!!!",
            "salt": "nope!!!",
            "ttl": 30,
            "creator_uid": creator_uid,
        })
        assert resp.status_code == 422

    def test_invalid_uid_format(self, http_client, crypto_client):
        password = crypto_client.generate_symmetric_key()
        plaintext = "test"
        encrypted, iv, salt = crypto_client.encrypt(plaintext, password)

        resp = http_client.post("/api/create", json={
            "encrypted_message": encrypted,
            "iv": iv,
            "salt": salt,
            "ttl": 30,
            "creator_uid": "invalid uid with spaces & <script>",
        })
        assert resp.status_code == 422

    def test_view_nonexistent(self, http_client):
        resp = _view_secret(http_client, "nonexistent_id_12345", uid="someuser")
        assert resp.status_code == 404

    def test_create_ttl_out_of_range(self, http_client, crypto_client):
        password = crypto_client.generate_symmetric_key()
        creator_key = crypto_client.generate_symmetric_key()
        creator_uid = crypto_client.generate_uid(creator_key)
        encrypted, iv, salt = crypto_client.encrypt("test", password)

        resp = http_client.post("/api/create", json={
            "encrypted_message": encrypted,
            "iv": iv,
            "salt": salt,
            "ttl": 9999,
            "creator_uid": creator_uid,
        })
        assert resp.status_code == 422

    def test_empty_encrypted_message(self, http_client, crypto_client):
        creator_key = crypto_client.generate_symmetric_key()
        creator_uid = crypto_client.generate_uid(creator_key)

        resp = http_client.post("/api/create", json={
            "encrypted_message": "",
            "iv": "AAAAAAAAAAAAAAAA",
            "salt": "AAAAAAAAAAAAAAAAAAAAAA==",
            "ttl": 30,
            "creator_uid": creator_uid,
        })
        assert resp.status_code == 422

    def test_view_missing_view_field(self, http_client):
        resp = http_client.post("/api/view", json={"uid": "abc"})
        assert resp.status_code == 422

    def test_non_owner_cannot_view_claimed(self, http_client, crypto_client):
        """After a secret is claimed, a non-owner uid should get 403."""
        view_id, _, _, plaintext = _create_secret(http_client, crypto_client)

        owner_key = crypto_client.generate_symmetric_key()
        owner_uid = crypto_client.generate_uid(owner_key)
        owner_password = crypto_client.generate_symmetric_key()

        _claim_secret(http_client, crypto_client, view_id, owner_uid, plaintext, owner_password)

        # Non-owner tries to view
        other_key = crypto_client.generate_symmetric_key()
        other_uid = crypto_client.generate_uid(other_key)

        resp = _view_secret(http_client, view_id, uid=other_uid)
        assert resp.status_code == 403
