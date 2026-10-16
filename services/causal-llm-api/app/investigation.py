
"""Prepare sensor evidence for the CAUSYN AI investigation agent."""

from pydantic import BaseModel


class Evidence(BaseModel):
    factor: str
    observation: str
    suggested_check: str


def investigate_sensors(data) -> list[Evidence]:
    """Identify unusual conditions using transparent demo rules."""

    evidence = []

    if data.tool_wear > 150:
        evidence.append(
            Evidence(
                factor="Elevated tool wear",
                observation=(
                    f"Tool wear is {data.tool_wear} minutes, "
                    "above the demonstration threshold of 150 minutes."
                ),
                suggested_check="Inspect tool condition and maintenance history.",
            )
        )

    temperature_difference = (
        data.process_temperature - data.air_temperature
    )

    if temperature_difference > 12:
        evidence.append(
            Evidence(
                factor="Large temperature differential",
                observation=(
                    f"Process temperature exceeds air temperature "
                    f"by {temperature_difference:.1f} K, "
                    "above the demonstration threshold of 12 K."
                ),
                suggested_check="Check cooling system and sensor calibration.",
            )
        )

    if data.torque > 55 and data.rotational_speed < 1400:
        evidence.append(
            Evidence(
                factor="High torque at low speed",
                observation=(
                    f"Torque is {data.torque} Nm at "
                    f"{data.rotational_speed} rpm."
                ),
                suggested_check="Inspect drive train and mechanical load.",
            )
        )

    return evidence
