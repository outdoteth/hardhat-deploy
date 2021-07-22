import {Web3Provider} from '@ethersproject/providers';
import {readValidations} from '@openzeppelin/hardhat-upgrades/dist/utils/validations';
import {
  assertStorageUpgradeSafe,
  assertUpgradeSafe,
  getImplementationAddress,
  getStorageLayout,
  getStorageLayoutForAddress,
  getUnlinkedBytecode,
  getVersion,
  Manifest,
  ProxyDeployment,
  ValidationData,
  Version,
  withValidationDefaults,
} from '@openzeppelin/upgrades-core';
import {Address, Deployment} from '../types';

export const openzeppelin_assertIsValidUpgrade = async (
  provider: Web3Provider,
  proxyAddress: Address,
  newImplementation: {bytecode?: string}
): Promise<undefined> => {
  const {version: newVersion, validations} = await getVersionAndValidations(
    newImplementation
  );

  const manifest = await Manifest.forNetwork(provider);

  const newStorageLayout = getStorageLayout(validations, newVersion);
  const oldStorageLayout = await getStorageLayoutForAddress(
    manifest,
    validations,
    await getImplementationAddress(provider, proxyAddress)
  );

  // This will throw an error if the upgrade is invalid.
  assertStorageUpgradeSafe(
    oldStorageLayout,
    newStorageLayout,
    withValidationDefaults({})
  );

  return;
};

export const openzeppelin_assertIsValidImplementation = async (implementation: {
  bytecode?: string;
}): Promise<undefined> => {
  const requiredOpts = withValidationDefaults({});
  const {version, validations} = await getVersionAndValidations(implementation);

  // This will throw an error if the implementation is invalid.
  assertUpgradeSafe(validations, version, requiredOpts);

  return;
};

export const openzeppelin_saveDeploymentManifest = async (
  provider: Web3Provider,
  proxy: Deployment,
  implementation: Deployment
): Promise<undefined> => {
  const {version, validations} = await getVersionAndValidations(implementation);

  const manifest = await Manifest.forNetwork(provider);
  await manifest.addProxy({
    address: proxy.address,
    txHash: proxy.transactionHash,
    kind: 'transparent',
  });

  await manifest.lockedRun(async () => {
    const manifestData = await manifest.read();
    const layout = getStorageLayout(validations, version);
    manifestData.impls[version.linkedWithoutMetadata] = {
      address: implementation.address,
      txHash: implementation.transactionHash,
      layout,
    };

    await manifest.write(manifestData);
  });

  return;
};

const getVersionAndValidations = async (implementation: {
  bytecode?: string;
}) => {
  if (implementation.bytecode === undefined)
    throw Error('No bytecode for implementation');

  // @ts-expect-error `hre` is actually defined globally
  const validations = await readValidations(hre);
  const unlinkedBytecode = getUnlinkedBytecode(
    validations,
    implementation.bytecode
  );
  const version = getVersion(unlinkedBytecode, implementation.bytecode);

  return {
    version,
    validations,
  };
};
