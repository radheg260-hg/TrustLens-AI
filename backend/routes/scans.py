from datetime import datetime, timezone
import re
from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    get_jwt_identity,
    jwt_required
)
from pymongo.errors import PyMongoError


# ==========================================================
# TRUSTLENS AI — SCAN ROUTES
# Phase 2.4
# ==========================================================

scans_bp = Blueprint(
    "scans",
    __name__,
    url_prefix="/api/scans"
)


# ==========================================================
# SERIALIZE SCAN
# ==========================================================

def serialize_scan(scan):
    """
    Convert MongoDB scan document into JSON-safe data.
    """

    return {
        "id": str(scan["_id"]),

        "user_id": str(
            scan["user_id"]
        ),

        "scan_type": scan.get(
            "scan_type",
            "message"
        ),

        "title": scan.get(
            "title",
            "Analysis Result"
        ),

        "original_content": scan.get(
            "original_content",
            ""
        ),

        "score": scan.get(
            "score",
            0
        ),

        "risk_level": scan.get(
            "risk_level",
            "Low Risk"
        ),

        "reasons": scan.get(
            "reasons",
            []
        ),

        "advice": scan.get(
            "advice",
            ""
        ),

        "created_at": (
            scan.get(
                "created_at"
            ).isoformat()
            if scan.get("created_at")
            else None
        )
    }


# ==========================================================
# GET AUTHENTICATED USER OBJECT ID
# ==========================================================

def get_authenticated_user_id():

    user_id = get_jwt_identity()

    if not ObjectId.is_valid(
        user_id
    ):
        return None

    return ObjectId(
        user_id
    )

def redact_sensitive_content(content):

    text = str(content or "")

    # OTP / verification code
    text = re.sub(
        r'(?i)\b(otp|verification code|one time password)\b'
        r'(\s*(?:is|:|-)?\s*)\d{4,8}\b',
        r'\1\2[REDACTED]',
        text
    )

    # CVV
    text = re.sub(
        r'(?i)\b(cvv|cvc)\b'
        r'(\s*(?:is|:|-)?\s*)\d{3,4}\b',
        r'\1\2[REDACTED]',
        text
    )

    # PIN
    text = re.sub(
        r'(?i)\b(pin|upi pin|atm pin)\b'
        r'(\s*(?:is|:|-)?\s*)\d{4,6}\b',
        r'\1\2[REDACTED]',
        text
    )

    # Password-like values
    text = re.sub(
        r'(?i)\b(password|passcode)\b'
        r'(\s*(?:is|:|-)?\s*)[^\s,.;]{4,}',
        r'\1\2[REDACTED]',
        text
    )

    # Long card/account-like numbers
    text = re.sub(
        r'\b(?:\d[\s-]?){12,19}\b',
        '[REDACTED NUMBER]',
        text
    )

    return text.strip()
# ==========================================================
# INITIALIZE ROUTES
# ==========================================================

def init_scan_routes(
    scans_collection
):

    # ======================================================
    # CREATE NEW SCAN
    # POST /api/scans
    # ======================================================

    @scans_bp.route(
        "",
        methods=["POST"]
    )
    @jwt_required()
    def create_scan():

        try:

            user_id = (
                get_authenticated_user_id()
            )

            if not user_id:

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid user session."
                }), 401


            data = (
                request.get_json(
                    silent=True
                )
                or {}
            )


            scan_type = str(
                data.get(
                    "scan_type",
                    ""
                )
            ).strip().lower()


            original_content = str(
                data.get(
                    "original_content",
                    ""
                )
            ).strip()


            title = str(
                data.get(
                    "title",
                    "Analysis Result"
                )
            ).strip()


            risk_level = str(
                data.get(
                    "risk_level",
                    "Low Risk"
                )
            ).strip()


            advice = str(
                data.get(
                    "advice",
                    ""
                )
            ).strip()


            reasons = data.get(
                "reasons",
                []
            )


            score = data.get(
                "score",
                0
            )


            # ----------------------------------------------
            # VALIDATE SCAN TYPE
            # ----------------------------------------------

            allowed_types = {
                "message",
                "link",
                "screenshot"
            }


            if (
                scan_type
                not in allowed_types
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid scan type."
                }), 400


            # ----------------------------------------------
            # VALIDATE CONTENT
            # ----------------------------------------------

            if not original_content:

                return jsonify({
                    "success": False,
                    "message":
                        "Scan content is required."
                }), 400


            # ----------------------------------------------
            # VALIDATE SCORE
            # ----------------------------------------------

            try:

                score = int(
                    score
                )

            except (
                TypeError,
                ValueError
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid risk score."
                }), 400


            score = max(
                0,
                min(
                    score,
                    100
                )
            )


            # ----------------------------------------------
            # VALIDATE REASONS
            # ----------------------------------------------

            if not isinstance(
                reasons,
                list
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Reasons must be a list."
                }), 400


            reasons = [
                str(reason).strip()
                for reason in reasons
                if str(reason).strip()
            ]


            # ----------------------------------------------
            # CREATE DOCUMENT
            # ----------------------------------------------

            scan_document = {

                "user_id":
                    user_id,

                "scan_type":
                    scan_type,

                "title":
                    title,

                "original_content":
                    redact_sensitive_content(
                        original_content
                    ),

                "score":
                    score,

                "risk_level":
                    risk_level,

                "reasons":
                    reasons,

                "advice":
                    advice,

                "created_at":
                    datetime.now(
                        timezone.utc
                    )
            }


            result = (
                scans_collection
                .insert_one(
                    scan_document
                )
            )


            created_scan = (
                scans_collection
                .find_one({
                    "_id":
                        result.inserted_id
                })
            )


            return jsonify({
                "success": True,
                "message":
                    "Scan saved successfully.",
                "scan":
                    serialize_scan(
                        created_scan
                    )
            }), 201


        except PyMongoError as error:

            print(
                "Create scan database error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while saving scan."
            }), 500


        except Exception as error:

            print(
                "Create scan error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to save scan."
            }), 500


    # ======================================================
    # GET CURRENT USER SCANS
    # GET /api/scans
    # ======================================================

    @scans_bp.route(
        "",
        methods=["GET"]
    )
    @jwt_required()
    def get_scans():

        try:

            user_id = (
                get_authenticated_user_id()
            )


            if not user_id:

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid user session."
                }), 401


            scans = list(
                scans_collection
                .find({
                    "user_id":
                        user_id
                })
                .sort(
                    "created_at",
                    -1
                )
            )


            return jsonify({
                "success": True,

                "count":
                    len(scans),

                "scans": [
                    serialize_scan(
                        scan
                    )
                    for scan
                    in scans
                ]
            }), 200


        except PyMongoError as error:

            print(
                "Get scans database error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while loading scan history."
            }), 500


        except Exception as error:

            print(
                "Get scans error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to load scan history."
            }), 500


    # ======================================================
    # GET ONE SCAN
    # GET /api/scans/<scan_id>
    # ======================================================

    @scans_bp.route(
        "/<scan_id>",
        methods=["GET"]
    )
    @jwt_required()
    def get_scan(
        scan_id
    ):

        try:

            user_id = (
                get_authenticated_user_id()
            )


            if not user_id:

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid user session."
                }), 401


            if not ObjectId.is_valid(
                scan_id
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid scan ID."
                }), 400


            scan = (
                scans_collection
                .find_one({
                    "_id":
                        ObjectId(
                            scan_id
                        ),

                    "user_id":
                        user_id
                })
            )


            if not scan:

                return jsonify({
                    "success": False,
                    "message":
                        "Scan not found."
                }), 404


            return jsonify({
                "success": True,

                "scan":
                    serialize_scan(
                        scan
                    )
            }), 200


        except PyMongoError as error:

            print(
                "Get scan database error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while loading scan."
            }), 500


        except Exception as error:

            print(
                "Get scan error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to load scan."
            }), 500


    # ======================================================
    # DELETE ONE SCAN
    # DELETE /api/scans/<scan_id>
    # ======================================================

    @scans_bp.route(
        "/<scan_id>",
        methods=["DELETE"]
    )
    @jwt_required()
    def delete_scan(
        scan_id
    ):

        try:

            user_id = (
                get_authenticated_user_id()
            )


            if not user_id:

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid user session."
                }), 401


            if not ObjectId.is_valid(
                scan_id
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid scan ID."
                }), 400


            result = (
                scans_collection
                .delete_one({
                    "_id":
                        ObjectId(
                            scan_id
                        ),

                    "user_id":
                        user_id
                })
            )


            if (
                result.deleted_count
                == 0
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "Scan not found."
                }), 404


            return jsonify({
                "success": True,
                "message":
                    "Scan deleted successfully."
            }), 200


        except PyMongoError as error:

            print(
                "Delete scan database error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while deleting scan."
            }), 500


        except Exception as error:

            print(
                "Delete scan error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to delete scan."
            }), 500


    # ======================================================
    # CLEAR CURRENT USER HISTORY
    # DELETE /api/scans
    # ======================================================

    @scans_bp.route(
        "",
        methods=["DELETE"]
    )
    @jwt_required()
    def clear_scans():

        try:

            user_id = (
                get_authenticated_user_id()
            )


            if not user_id:

                return jsonify({
                    "success": False,
                    "message":
                        "Invalid user session."
                }), 401


            result = (
                scans_collection
                .delete_many({
                    "user_id":
                        user_id
                })
            )


            return jsonify({
                "success": True,

                "message":
                    "Scan history cleared successfully.",

                "deleted_count":
                    result.deleted_count
            }), 200


        except PyMongoError as error:

            print(
                "Clear scan history database error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while clearing scan history."
            }), 500


        except Exception as error:

            print(
                "Clear scan history error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to clear scan history."
            }), 500


    return scans_bp