# AMD Developer Cloud deployment (Day 5 target)

AMD GPU deployment is **not yet complete**. No cloud credits or credentials are required for Day 1.

1. Confirm promotional credits and GPU Droplet pricing **before** provisioning anything.
2. Provision a compatible AMD GPU Droplet only when access is approved.
3. Verify ROCm and vLLM support for the chosen GPU, image, and open-weight model.
4. Deploy vLLM using its supported ROCm configuration, bind to a secured endpoint, and validate `/v1/models` and chat completions.
5. Configure the causal service's AMD vLLM client on Day 3/5, test live end-to-end inference, and record evidence.
6. Never commit credentials, expose an unauthenticated public inference endpoint, or claim deployment before verification.

**Day 1 scope:** architecture and container placeholders only; not GPU provisioning.
