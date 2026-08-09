from datetime import timedelta

import bcrypt

from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required
)
from pymongo.errors import DuplicateKeyError, PyMongoError


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


def init_auth_routes(users_collection):
    """
    Register authentication routes using the users collection.
    """

    @auth_bp.route("/register", methods=["POST"])
    def register():
        try:
            data = request.get_json(silent=True) or {}

            name = str(
                data.get("name", "")
            ).strip()

            email = str(
                data.get("email", "")
            ).strip().lower()

            password = str(
                data.get("password", "")
            )

            if not name:
                return jsonify({
                    "success": False,
                    "message":
                        "Full name is required."
                }), 400

            if len(name) < 2:
                return jsonify({
                    "success": False,
                    "message":
                        "Full name must contain at least 2 characters."
                }), 400

            if not email:
                return jsonify({
                    "success": False,
                    "message":
                        "Email address is required."
                }), 400

            if (
                "@" not in email or
                "." not in email
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Please enter a valid email address."
                }), 400

            if len(password) < 8:
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least 8 characters."
                }), 400

            if not any(
                character.isalpha()
                for character in password
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least one letter."
                }), 400

            if not any(
                character.isdigit()
                for character in password
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Password must contain at least one number."
                }), 400

            existing_user = (
                users_collection.find_one({
                    "email": email
                })
            )

            if existing_user:
                return jsonify({
                    "success": False,
                    "message":
                        "An account already exists with this email."
                }), 409

            password_hash = (
                bcrypt.hashpw(
                    password.encode("utf-8"),
                    bcrypt.gensalt()
                )
                .decode("utf-8")
            )

            user_document = {
                "name": name,
                "email": email,
                "password_hash":
                    password_hash,
                "account_status":
                    "active",
                "is_demo": False
            }

            result = (
                users_collection.insert_one(
                    user_document
                )
            )

            return jsonify({
                "success": True,
                "message":
                    "Account created successfully.",
                "user": {
                    "id":
                        str(result.inserted_id),
                    "name":
                        name,
                    "email":
                        email
                }
            }), 201

        except DuplicateKeyError:
            return jsonify({
                "success": False,
                "message":
                    "An account already exists with this email."
            }), 409

        except PyMongoError as error:
            print(
                "MongoDB register error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while creating account."
            }), 500

        except Exception as error:
            print(
                "Register error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to create account."
            }), 500


    @auth_bp.route("/login", methods=["POST"])
    def login():
        try:
            data = request.get_json(
                silent=True
            ) or {}

            email = str(
                data.get("email", "")
            ).strip().lower()

            password = str(
                data.get("password", "")
            )

            if not email or not password:
                return jsonify({
                    "success": False,
                    "message":
                        "Email and password are required."
                }), 400

            user = (
                users_collection.find_one({
                    "email": email
                })
            )

            if not user:
                return jsonify({
                    "success": False,
                    "message":
                        "Email or password is incorrect."
                }), 401

            saved_password_hash = (
                user.get(
                    "password_hash",
                    ""
                )
            )

            if not saved_password_hash:
                return jsonify({
                    "success": False,
                    "message":
                        "This account cannot be authenticated."
                }), 401

            password_is_correct = (
                bcrypt.checkpw(
                    password.encode("utf-8"),
                    saved_password_hash.encode(
                        "utf-8"
                    )
                )
            )

            if not password_is_correct:
                return jsonify({
                    "success": False,
                    "message":
                        "Email or password is incorrect."
                }), 401

            if (
                user.get(
                    "account_status"
                ) != "active"
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "This account is currently unavailable."
                }), 403

            user_id = str(
                user["_id"]
            )

            access_token = (
                create_access_token(
                    identity=user_id,
                    expires_delta=timedelta(
                        hours=12
                    )
                )
            )

            return jsonify({
                "success": True,
                "message":
                    "Login successful.",
                "access_token":
                    access_token,
                "user": {
                    "id":
                        user_id,
                    "name":
                        user.get(
                            "name",
                            "User"
                        ),
                    "email":
                        user.get(
                            "email",
                            ""
                        ),
                    "is_demo":
                        bool(
                            user.get(
                                "is_demo",
                                False
                            )
                        )
                }
            }), 200

        except PyMongoError as error:
            print(
                "MongoDB login error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Database error while signing in."
            }), 500

        except Exception as error:
            print(
                "Login error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to sign in."
            }), 500

        # ======================================================
    # DEMO LOGIN
    # ======================================================

    @auth_bp.route("/demo", methods=["POST"])
    def demo_login():

        try:

            demo_email = "demo@trustlens.local"

            demo_user = users_collection.find_one({
                "email": demo_email
            })

            # Create the demo account automatically
            # if it does not already exist.

            if not demo_user:

                demo_document = {
                    "name": "Demo User",
                    "email": demo_email,
                    "password_hash": "",
                    "account_status": "active",
                    "is_demo": True
                }

                result = users_collection.insert_one(
                    demo_document
                )

                user_id = str(
                    result.inserted_id
                )

            else:

                if (
                    demo_user.get(
                        "account_status"
                    ) != "active"
                ):

                    return jsonify({
                        "success": False,
                        "message":
                            "Demo access is currently unavailable."
                    }), 403

                user_id = str(
                    demo_user["_id"]
                )


            access_token = create_access_token(
                identity=user_id,
                expires_delta=timedelta(
                    hours=2
                )
            )


            return jsonify({

                "success": True,

                "message":
                    "Demo session started.",

                "access_token":
                    access_token,

                "user": {
                    "id":
                        user_id,

                    "name":
                        "Demo User",

                    "email":
                        demo_email,

                    "is_demo":
                        True
                }

            }), 200


        except PyMongoError as error:

            print(
                "MongoDB demo-login error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to start demo session."
            }), 500


        except Exception as error:

            print(
                "Demo-login error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to start demo session."
            }), 500

    @auth_bp.route("/me", methods=["GET"])
    @jwt_required()
    def current_user():
        try:
            user_id = get_jwt_identity()

            if not ObjectId.is_valid(
                user_id
            ):
                return jsonify({
                    "success": False,
                    "message":
                        "Invalid user session."
                }), 401

            user = (
                users_collection.find_one({
                    "_id":
                        ObjectId(user_id)
                })
            )

            if not user:
                return jsonify({
                    "success": False,
                    "message":
                        "User account not found."
                }), 404

            return jsonify({
                "success": True,
                "user": {
                    "id":
                        str(user["_id"]),
                    "name":
                        user.get(
                            "name",
                            "User"
                        ),
                    "email":
                        user.get(
                            "email",
                            ""
                        ),
                    "account_status":
                        user.get(
                            "account_status",
                            "active"
                        ),
                    "is_demo":
                        bool(
                            user.get(
                                "is_demo",
                                False
                            )
                        )
                }
            }), 200

        except PyMongoError as error:
            print(
                "MongoDB current-user error:",
                error
            )

            return jsonify({
                "success": False,
                "message":
                    "Unable to load user."
            }), 500

    return auth_bp