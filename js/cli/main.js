/**
 * Exercises the token-whitelist program
 *
 * @flow
 */

import {
  InitTokenWhitelist,
  AddToWhitelist,
  RemoveFromWhitelist,
  CloseWhitelistAccount,
} from './token-whitelist-test';

async function main() {
  // These test cases are designed to run sequentially and in the following order
  console.log('Run test: InitTokenWhitelist');
  await InitTokenWhitelist();
  console.log('Run test: AddToWhitelist');
  await AddToWhitelist();
  console.log('Run test: RemoveFromWhitelist');
  await RemoveFromWhitelist();
  console.log('Run test: CloseWhitelistAccount');
  await CloseWhitelistAccount();
  console.log('Success\n');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());
