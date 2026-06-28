"""Phase 0 read-only descriptor dump for the AX206 USB-Display (VID 1908 / PID 0102).
Requires WinUSB bound to the device (Zadig) and: pip install pyusb libusb-package.
Reads descriptors + string descriptors only. Does NOT write to the LCD."""
import sys
import usb.core
import usb.util

VID, PID = 0x1908, 0x0102


def find_device():
    try:
        import libusb_package
        dev = libusb_package.find(idVendor=VID, idProduct=PID)
        if dev is not None:
            return dev
    except ImportError:
        pass
    return usb.core.find(idVendor=VID, idProduct=PID)


dev = find_device()
if dev is None:
    sys.exit("Device 1908:0102 not found. Is WinUSB bound via Zadig? Is the panel plugged in?")

print(f"Found {VID:#06x}:{PID:#06x}  bus={dev.bus} addr={dev.address} speed={dev.speed}")
for cfg in dev:
    print(f"\nConfig {cfg.bConfigurationValue}  maxPower={cfg.bMaxPower * 2}mA  interfaces={cfg.bNumInterfaces}")
    for intf in cfg:
        print(f"  Interface {intf.bInterfaceNumber} alt {intf.bAlternateSetting}  "
              f"class=0x{intf.bInterfaceClass:02x} sub=0x{intf.bInterfaceSubClass:02x} "
              f"proto=0x{intf.bInterfaceProtocol:02x}")
        for ep in intf:
            direction = "IN " if usb.util.endpoint_direction(ep.bEndpointAddress) == usb.util.ENDPOINT_IN else "OUT"
            ep_type = {0: "control", 1: "iso", 2: "bulk", 3: "interrupt"}[usb.util.endpoint_type(ep.bmAttributes)]
            print(f"    EP 0x{ep.bEndpointAddress:02x} {direction} {ep_type:9s} maxPacket={ep.wMaxPacketSize}")

print("\nString descriptors:")
for name, idx in (("manufacturer", dev.iManufacturer), ("product", dev.iProduct), ("serial", dev.iSerialNumber)):
    try:
        print(f"  {name:12s} [{idx}] = {usb.util.get_string(dev, idx)!r}")
    except Exception as e:
        print(f"  {name:12s} [{idx}] = <read failed: {e}>")
