"""
Flight Price Provider Service Layer.
Pluggable provider architecture supporting real-time APIs (Amadeus, Kiwi) and Simulator fallback.
"""

from __future__ import annotations

import json
import logging
import random
import time
from dataclasses import dataclass, asdict
from datetime import date, timedelta
from typing import Optional, Dict, Any

import redis
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class FlightPriceResult:
    route: str
    origin: str
    destination: str
    price: int
    provider: str
    is_real_time: bool
    airline: str
    flight_number: str
    currency: str = "INR"
    timestamp: str = ""
    status_code: int = 200
    details: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


MOCK_PRICE_RANGES = {
    "DEL-BOM": (3000, 7000),
    "BLR-HYD": (1500, 4000),
    "DEL-BLR": (4000, 9000),
    "BOM-GOA": (2000, 5000),
    "BOM-DEL": (3000, 7000),
    "HYD-BLR": (1500, 4000),
    "BLR-DEL": (4000, 9000),
    "GOA-BOM": (2000, 5000),
}

MOCK_AIRLINES = [
    ("IndiGo", "6E-", 100, 999),
    ("Air India", "AI-", 400, 899),
    ("Vistara", "UK-", 700, 990),
    ("SpiceJet", "SG-", 100, 599),
    ("Akasa Air", "QP-", 1100, 1500),
]


class BaseFlightProvider:
    """Abstract base provider for flight prices."""

    name = "base"

    def get_route_price(self, origin: str, destination: str, force_refresh: bool = False) -> FlightPriceResult:
        raise NotImplementedError


class MockFlightProvider(BaseFlightProvider):
    """
    Zero-cost stochastic flight pricing engine.
    Used for local testing, offline demo, and graceful fallback.
    """

    name = "simulator"

    def get_route_price(self, origin: str, destination: str, force_refresh: bool = False) -> FlightPriceResult:
        route = f"{origin}-{destination}".upper()
        price_range = MOCK_PRICE_RANGES.get(route, (2500, 7500))
        price = random.randint(*price_range)

        airline_name, code_prefix, num_min, num_max = random.choice(MOCK_AIRLINES)
        flight_no = f"{code_prefix}{random.randint(num_min, num_max)}"

        return FlightPriceResult(
            route=route,
            origin=origin,
            destination=destination,
            price=price,
            provider="simulator",
            is_real_time=False,
            airline=airline_name,
            flight_number=flight_no,
            currency="INR",
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            status_code=200,
            details={"mode": "stochastic_simulation", "price_range": price_range},
        )


class AmadeusFlightProvider(BaseFlightProvider):
    """
    Amadeus Self-Service API Provider.
    Calls https://test.api.amadeus.com/v2/shopping/flight-offers
    with automatic OAuth2 client-credentials token caching.
    """

    name = "amadeus"
    TOKEN_URL = "https://test.api.amadeus.com/v1/security/oauth2/token"
    OFFERS_URL = "https://test.api.amadeus.com/v2/shopping/flight-offers"

    _cached_token: Optional[str] = None
    _token_expiry: float = 0.0

    def __init__(self, client_id: str = "", client_secret: str = ""):
        self.client_id = client_id or getattr(settings, "AMADEUS_CLIENT_ID", "")
        self.client_secret = client_secret or getattr(settings, "AMADEUS_CLIENT_SECRET", "")
        self.fallback = MockFlightProvider()

    def _get_access_token(self) -> Optional[str]:
        if not self.client_id or not self.client_secret:
            return None

        # Return cached token if valid for at least another 60 seconds
        if self._cached_token and time.time() < (self._token_expiry - 60):
            return self._cached_token

        try:
            resp = requests.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=8,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._cached_token = data.get("access_token")
                expires_in = data.get("expires_in", 1799)
                self._token_expiry = time.time() + expires_in
                return self._cached_token
            logger.warning("Amadeus auth failed with status %s: %s", resp.status_code, resp.text)
        except Exception as ex:
            logger.error("Amadeus auth request exception: %s", ex)
        return None

    def get_route_price(self, origin: str, destination: str, force_refresh: bool = False) -> FlightPriceResult:
        route = f"{origin}-{destination}".upper()

        token = self._get_access_token()
        if not token:
            # Fallback to simulation if credentials absent or failed
            result = self.fallback.get_route_price(origin, destination, force_refresh=force_refresh)
            result.provider = "amadeus_simulated"
            result.details = {
                "note": "Amadeus credentials not set or auth expired. Using simulated prices.",
                "configured": bool(self.client_id),
            }
            return result

        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        params = {
            "originLocationCode": origin,
            "destinationLocationCode": destination,
            "departureDate": tomorrow,
            "adults": 1,
            "max": 3,
            "currencyCode": "INR",
        }

        try:
            resp = requests.get(
                self.OFFERS_URL,
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=10,
            )

            if resp.status_code == 200:
                data = resp.json()
                offers = data.get("data", [])
                if offers:
                    cheapest = offers[0]
                    total_price = float(cheapest.get("price", {}).get("total", 0))
                    itin = cheapest.get("itineraries", [{}])[0]
                    first_seg = itin.get("segments", [{}])[0]
                    carrier = first_seg.get("carrierCode", "AI")
                    flight_num = f"{carrier}-{first_seg.get('number', '101')}"

                    return FlightPriceResult(
                        route=route,
                        origin=origin,
                        destination=destination,
                        price=int(round(total_price)) or 3500,
                        provider="amadeus",
                        is_real_time=True,
                        airline=f"Carrier {carrier}",
                        flight_number=flight_num,
                        currency="INR",
                        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        status_code=200,
                        details={"amadeus_offer_id": cheapest.get("id")},
                    )

            logger.warning("Amadeus search returned status %s: %s", resp.status_code, resp.text)
        except Exception as ex:
            logger.error("Amadeus API error: %s", ex)

        # Fallback on API failure
        result = self.fallback.get_route_price(origin, destination)
        result.provider = "amadeus_simulated"
        result.details = {"note": "Amadeus API call timed out or returned no offers. Fallback used."}
        return result


class KiwiFlightProvider(BaseFlightProvider):
    """
    Kiwi / Tequila Search API Provider.
    """

    name = "kiwi"
    SEARCH_URL = "https://api.tequila.kiwi.com/v2/search"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or getattr(settings, "KIWI_API_KEY", "")
        self.fallback = MockFlightProvider()

    def get_route_price(self, origin: str, destination: str, force_refresh: bool = False) -> FlightPriceResult:
        route = f"{origin}-{destination}".upper()
        if not self.api_key:
            result = self.fallback.get_route_price(origin, destination, force_refresh=force_refresh)
            result.provider = "kiwi_simulated"
            return result

        tomorrow = (date.today() + timedelta(days=1)).strftime("%d/%m/%Y")
        params = {
            "fly_from": origin,
            "fly_to": destination,
            "date_from": tomorrow,
            "date_to": tomorrow,
            "curr": "INR",
            "limit": 1,
        }
        try:
            resp = requests.get(
                self.SEARCH_URL,
                headers={"apikey": self.api_key},
                params=params,
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                if data:
                    item = data[0]
                    return FlightPriceResult(
                        route=route,
                        origin=origin,
                        destination=destination,
                        price=int(item.get("price", 3000)),
                        provider="kiwi",
                        is_real_time=True,
                        airline=item.get("airlines", ["Airline"])[0],
                        flight_number=f"KW-{item.get('route', [{}])[0].get('flight_no', '99')}",
                        currency="INR",
                        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        status_code=200,
                    )
        except Exception as ex:
            logger.error("Kiwi API error: %s", ex)

        result = self.fallback.get_route_price(origin, destination, force_refresh=force_refresh)
        result.provider = "kiwi_simulated"
        return result


class CachedFlightProvider(BaseFlightProvider):
    """
    Wraps any flight provider with a Redis-backed 30-second snapshot cache.
    Guarantees that the Frontend Flight Radar and Celery Beat worker
    evaluate against the exact same price snapshot, while allowing on-demand
    force_refresh when explicitly requested (e.g. Scan Now button).
    """

    def __init__(self, inner_provider: BaseFlightProvider, ttl_seconds: int = 30):
        self.inner_provider = inner_provider
        self.ttl = ttl_seconds
        self.name = inner_provider.name

    def _get_redis_client(self):
        try:
            redis_url = getattr(settings, "REDIS_URL", "redis://127.0.0.1:6379/0")
            return redis.Redis.from_url(redis_url)
        except Exception as err:
            logger.warning("Redis client connection failed for flight cache: %s", err)
            return None

    def get_route_price(self, origin: str, destination: str, force_refresh: bool = False) -> FlightPriceResult:
        route = f"{origin}-{destination}".upper()
        cache_key = f"pulsenotify:flight_price:{route}"
        r = self._get_redis_client()

        # If cache exists and force_refresh is not requested, return cached snapshot
        if r and not force_refresh:
            try:
                cached_data = r.get(cache_key)
                if cached_data:
                    data = json.loads(cached_data)
                    return FlightPriceResult(**data)
            except Exception as ex:
                logger.warning("Failed reading price cache from Redis for %s: %s", route, ex)

        # Fresh price evaluation from underlying provider
        result = self.inner_provider.get_route_price(origin, destination, force_refresh=force_refresh)

        # Persist fresh snapshot to Redis with 30-second TTL
        if r:
            try:
                r.set(cache_key, json.dumps(result.to_dict()), ex=self.ttl)
            except Exception as ex:
                logger.warning("Failed setting price cache in Redis for %s: %s", route, ex)

        return result


def get_flight_provider() -> BaseFlightProvider:
    """Factory to get the configured flight price provider wrapped with a 30s Redis cache."""
    provider_name = getattr(settings, "FLIGHT_PRICE_PROVIDER", "amadeus").lower().strip()
    if provider_name == "kiwi":
        base_provider = KiwiFlightProvider()
    elif provider_name in ("simulator", "mock"):
        base_provider = MockFlightProvider()
    else:
        base_provider = AmadeusFlightProvider()

    return CachedFlightProvider(base_provider, ttl_seconds=30)
