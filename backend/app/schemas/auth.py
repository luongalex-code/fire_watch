from pydantic import BaseModel


class LoginIn(BaseModel):
    email: str
    password: str


class AuthUserOut(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    role: str


class LoginOut(BaseModel):
    user: AuthUserOut
    message: str = "Login successful"
