import hashlib
import os
import platform
import subprocess
import uuid

def get_hwid() -> str:
    """
    Deterministically extracts hardware components and generates a SHA-256 digest.
    Works seamlessly across Windows, Linux, and macOS.
    """
    system = platform.system()
    raw_hwid_components = []

    try:
        if system == "Windows":
            # 1. CPU Processor ID via WMIC or registry
            try:
                out = subprocess.check_output("wmic cpu get processorid", shell=True).decode()
                raw_hwid_components.append("".join(out.split()[1:]))
            except Exception:
                pass

            # 2. Motherboard UUID
            try:
                out = subprocess.check_output("wmic csproduct get uuid", shell=True).decode()
                raw_hwid_components.append("".join(out.split()[1:]))
            except Exception:
                pass

            # 3. Disk Serial Number
            try:
                out = subprocess.check_output("wmic diskdrive get serialnumber", shell=True).decode()
                raw_hwid_components.append("".join(out.split()[1:]))
            except Exception:
                pass

        elif system == "Linux":
            # Linux Machine ID
            if os.path.exists("/etc/machine-id"):
                with open("/etc/machine-id", "r") as f:
                    raw_hwid_components.append(f.read().strip())
            elif os.path.exists("/var/lib/dbus/machine-id"):
                with open("/var/lib/dbus/machine-id", "r") as f:
                    raw_hwid_components.append(f.read().strip())

        elif system == "Darwin":
            # macOS IOPlatformUUID
            out = subprocess.check_output("ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID", shell=True).decode()
            raw_hwid_components.append(out.strip())

    except Exception:
        pass

    # Fallback to Node UUID if system queries fail
    if not raw_hwid_components:
        raw_hwid_components.append(str(uuid.getnode()))

    combined = "".join(raw_hwid_components)
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()
