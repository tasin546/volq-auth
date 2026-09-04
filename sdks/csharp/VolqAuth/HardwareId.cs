using System;
using System.Security.Cryptography;
using System.Text;
using System.Management;
using System.Runtime.InteropServices;

namespace VolqAuth
{
    public static class HardwareId
    {
        public static string GetHWID()
        {
            var sb = new StringBuilder();

            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                try
                {
                    // 1. Processor ID
                    using (var searcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor"))
                    {
                        foreach (var obj in searcher.Get())
                        {
                            sb.Append(obj["ProcessorId"]?.ToString());
                        }
                    }

                    // 2. Motherboard UUID
                    using (var searcher = new ManagementObjectSearcher("SELECT UUID FROM Win32_ComputerSystemProduct"))
                    {
                        foreach (var obj in searcher.Get())
                        {
                            sb.Append(obj["UUID"]?.ToString());
                        }
                    }

                    // 3. BIOS Serial Number
                    using (var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS"))
                    {
                        foreach (var obj in searcher.Get())
                        {
                            sb.Append(obj["SerialNumber"]?.ToString());
                        }
                    }
                }
                catch
                {
                    // Fallback to MachineGuid if WMI is restricted
                    sb.Append(Environment.MachineName);
                }
            }
            else
            {
                sb.Append(Environment.MachineName);
            }

            using (var sha256 = SHA256.Create())
            {
                byte[] hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString()));
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
        }
    }
}
