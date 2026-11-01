"""Contrato de entrada y salida del link de clase (HU #33)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LinkClaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    comision: str = Field(min_length=1)
    url: str = Field(min_length=1)


class LinkClaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ok: bool = True
    link: str | None = None
    error: str | None = None
