from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


class ExpertInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=160)
    expertise: str = Field(min_length=1, max_length=200)
    organization: str | None = Field(default=None, max_length=160)
    region: str | None = Field(default=None, max_length=120)
    languages: str | None = Field(default=None, max_length=160)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=50)
    website: AnyHttpUrl | None = Field(default=None, max_length=500)
    bio: str | None = Field(default=None, max_length=2000)


class ExpertRecord(ExpertInput):
    id: str
    created_at: str
    updated_at: str
