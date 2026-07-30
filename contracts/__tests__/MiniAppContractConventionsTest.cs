using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Conventions every game contract in this repo has to follow.
    ///
    /// This gate used to live in the platform contract repo, back when the game
    /// contracts were built there. They are built here now, so the rule follows
    /// the contracts - leaving it behind would have left it enforcing nothing.
    /// </summary>
    public class MiniAppContractConventionsTest
    {
        private static string BuildDir =>
            Path.Combine(ContractSourceAssertions.FindRepoRoot(), "contracts", "build");

        private static IEnumerable<string> DeployableManifests()
        {
            // Test-only fixtures are not deployed, so the deployability rules
            // below do not apply to them.
            return Directory
                .GetFiles(BuildDir, "MiniApp*.manifest.json")
                .Where(path => !Path.GetFileNameWithoutExtension(path)
                    .Contains("Fixture", StringComparison.Ordinal))
                .OrderBy(path => path, StringComparer.Ordinal);
        }

        private static bool ExposesMethod(string manifestPath, string method)
        {
            using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(manifestPath));
            return doc.RootElement
                .GetProperty("abi")
                .GetProperty("methods")
                .EnumerateArray()
                .Any(entry => entry.GetProperty("name").GetString() == method);
        }

        [Fact]
        public void TheBuildDirectoryHoldsTheGameContracts()
        {
            // Without this, every rule below passes by iterating over nothing -
            // a missing build would read as a clean bill of health.
            Assert.True(Directory.Exists(BuildDir), $"Expected compiled contracts at {BuildDir}. Run contracts/build.sh");
            Assert.True(
                DeployableManifests().Any(),
                $"No deployable MiniApp manifests in {BuildDir}; the conventions below would assert nothing.");
        }

        [Fact]
        public void EveryGameContractExposesAnUpdateMethod()
        {
            List<string> offenders = DeployableManifests()
                .Where(path => !ExposesMethod(path, "update"))
                .Select(Path.GetFileNameWithoutExtension)
                .ToList();

            Assert.True(
                offenders.Count == 0,
                "Every deployable miniapp contract must expose an owner-gated update() so fixes can be " +
                $"applied in place. Missing: {string.Join(", ", offenders)}");
        }
    }
}
