import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@aragon/ui';

import BigNumber from 'bignumber.js';
import {
  getBalanceBonded,
  getBalanceOfStaged,
  getEpoch,
  getExpansionAmount,
  getFluidUntil,
  getInstantaneousQSDPrice,
  getLockedUntil,
  getStatusOf,
  getTokenAllowance,
  getTokenBalance,
  getTokenTotalSupply,
  getTotalBonded,
} from '../../utils/infura';
import { QSD, QSDS } from '../../constants/tokens';
import { DAO_EXIT_LOCKUP_EPOCHS } from '../../constants/values';
import { toTokenUnitsBN, toBaseUnitBN, toFloat } from '../../utils/number';
import {
  approve,
  deposit,
  withdraw,
  bond,
  unbondUnderlying,
} from '../../utils/web3';

import AccountPageHeader from './Header';
import { WithdrawDeposit, BondUnbond, IconHeader, Guide } from '../common';

function Wallet({ user }: { user: string }) {
  const { override } = useParams();
  if (override) {
    user = override;
  }

  const [epoch, setEpoch] = useState<number>(0);
  const [qsdPrice, setQSDPrice] = useState<BigNumber | null>(null);
  const [totalBonded, setTotalBonded] = useState(new BigNumber(0));
  const [userQSDBalance, setUserQSDBalance] = useState(new BigNumber(0));
  const [userQSDAllowance, setUserQSDAllowance] = useState(new BigNumber(0));
  const [userQSDSBalance, setUserQSDSBalance] = useState(new BigNumber(0));
  const [totalQSDSSupply, setTotalQSDSSupply] = useState(new BigNumber(0));
  const [userStagedBalance, setUserStagedBalance] = useState(new BigNumber(0));
  const [userBondedBalance, setUserBondedBalance] = useState(new BigNumber(0));
  const [userStatus, setUserStatus] = useState(0);
  const [userStatusUnlocked, setUserStatusUnlocked] = useState(0);
  const [lockup, setLockup] = useState(0);
  const [expansionAmount, setExpansionAmount] = useState<number | null>(null);

  // Updates APR
  useEffect(() => {
    const updateAPR = async () => {
      const [
        epoch,
        qsdPrice,
        expansionAmount,
        esdsSupply,
        esdsBonded,
      ] = await Promise.all([
        getEpoch(QSDS.addr),
        getInstantaneousQSDPrice(),
        getExpansionAmount(),
        getTokenTotalSupply(QSDS.addr),
        getTotalBonded(QSDS.addr),
      ]);

      const totalQSDSSupply = toTokenUnitsBN(esdsSupply, QSDS.decimals);

      setEpoch(parseInt(epoch, 10));
      setLockup(DAO_EXIT_LOCKUP_EPOCHS);
      setQSDPrice(qsdPrice);
      setExpansionAmount(expansionAmount);
      setTotalQSDSSupply(new BigNumber(totalQSDSSupply));
      setTotalBonded(toTokenUnitsBN(esdsBonded, QSD.decimals));
    };

    updateAPR();
  }, []);

  //Update User balances
  useEffect(() => {
    if (user === '') {
      setUserQSDBalance(new BigNumber(0));
      setUserQSDAllowance(new BigNumber(0));
      setUserQSDSBalance(new BigNumber(0));
      setTotalQSDSSupply(new BigNumber(0));
      setUserStagedBalance(new BigNumber(0));
      setUserBondedBalance(new BigNumber(0));
      setUserStatus(0);
      return;
    }
    let isCancelled = false;

    async function updateUserInfo() {
      const [
        esdBalance,
        esdAllowance,
        esdsBalance,
        stagedBalance,
        bondedBalance,
        status,
        fluidUntilStr,
        lockedUntilStr,
      ] = await Promise.all([
        getTokenBalance(QSD.addr, user),
        getTokenAllowance(QSD.addr, user, QSDS.addr),
        getTokenBalance(QSDS.addr, user),
        getBalanceOfStaged(QSDS.addr, user),
        getBalanceBonded(QSDS.addr, user),
        getStatusOf(QSDS.addr, user),

        getFluidUntil(QSDS.addr, user),
        getLockedUntil(QSDS.addr, user),
      ]);

      const userQSDBalance = toTokenUnitsBN(esdBalance, QSD.decimals);
      const userQSDSBalance = toTokenUnitsBN(esdsBalance, QSDS.decimals);
      const userStagedBalance = toTokenUnitsBN(stagedBalance, QSDS.decimals);
      const userBondedBalance = toTokenUnitsBN(bondedBalance, QSDS.decimals);
      const userStatus = parseInt(status, 10);
      const fluidUntil = parseInt(fluidUntilStr, 10);
      const lockedUntil = parseInt(lockedUntilStr, 10);

      if (!isCancelled) {
        setUserQSDBalance(new BigNumber(userQSDBalance));
        setUserQSDAllowance(new BigNumber(esdAllowance));
        setUserQSDSBalance(new BigNumber(userQSDSBalance));
        setUserStagedBalance(new BigNumber(userStagedBalance));
        setUserBondedBalance(new BigNumber(userBondedBalance));
        setUserStatus(userStatus);
        setUserStatusUnlocked(Math.max(fluidUntil, lockedUntil));
      }
    }
    updateUserInfo();
    const id = setInterval(updateUserInfo, 15000);

    // eslint-disable-next-line consistent-return
    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, [user]);

  let daoWeeklyYield = '...';
  let daoHourlyYield = '...';
  let daoDailyYield = '...';

  // Define number formatting
  var options = { minimumFractionDigits: 0,
                maximumFractionDigits: 2 };
  var numberFormat = new Intl.NumberFormat('en-US', options);

  // Calculate DAO APR (4 hrs)
  if (qsdPrice && totalBonded && expansionAmount) {
    if (epoch <= 72) {
      const totalQSD = toFloat(totalBonded);
      const qsdToAdd = expansionAmount / 2;

      const daoYield = (qsdToAdd / totalQSD) * 100;

      daoHourlyYield = numberFormat.format(daoYield / 4) + '%';
      daoDailyYield = numberFormat.format(daoYield * 6) + '%';
      daoWeeklyYield = numberFormat.format(daoYield * 6 * 7) + '%';
    } else {
      daoWeeklyYield = '0%';
      daoHourlyYield = '0%';
      daoDailyYield = '0%';
    }
  }

  return (
    <Layout>
      <Guide
        aprs={{
          hourly: daoHourlyYield,
          daily: daoDailyYield,
          weekly: daoWeeklyYield,
        }}
        bodyInstructions={
          <p>
            Note: Rewards are only applicable during bootstrapping phase i.e.
            the first 72 epochs
            <br />
            <br />
            Step 1: Stage your QSD
            <br />
            Step 2: Bond your QSD
            <br />
            Step 3: Unbond any amount of rewards you wish to claim
            <br />
            Step 4: Claim rewards after 1 epoch
            <br />
            <br />
            <b>
              Note: Please unbond your QSD during epoch 73. At the beginning of
              epoch 74 withdraw your QSD to your wallet and then stage and bond
              your tokens on the QSD page to continue receiving rewards. (You
              will be unable to bond QSD when TWAP is above peg from Epoch 75
              onwards)
            </b>
          </p>
        }
      />

      <IconHeader
        icon={<i className='fas fa-dot-circle' />}
        text='Bootstrapping Rewards'
      />

      <AccountPageHeader
        accountQSDBalance={userQSDBalance}
        accountQSDSBalance={userQSDSBalance}
        totalQSDSSupply={totalQSDSSupply}
        accountStagedBalance={userStagedBalance}
        accountBondedBalance={userBondedBalance}
        accountStatus={userStatus}
        unlocked={userStatusUnlocked}
      />

      {/* <WithdrawDeposit
        user={user}
        balance={userQSDBalance}
        allowance={userQSDAllowance}
        stagedBalance={userStagedBalance}
        status={userStatus}
      /> */}

      <WithdrawDeposit
        suffix='QSD'
        balance={userQSDBalance}
        allowance={userQSDAllowance}
        stagedBalance={userStagedBalance}
        status={userStatus}
        disabled={!user}
        handleApprove={() => {
          approve(QSD.addr, QSDS.addr);
        }}
        handleDeposit={(depositAmount) => {
          deposit(QSDS.addr, toBaseUnitBN(depositAmount, QSD.decimals));
        }}
        handleWithdraw={(withdrawAmount) => {
          withdraw(QSDS.addr, toBaseUnitBN(withdrawAmount, QSD.decimals));
        }}
      />

      {/* <BondUnbond
        staged={userStagedBalance}
        bonded={userBondedBalance}
        status={userStatus}
        lockup={lockup}
      /> */}

      <BondUnbond
        suffix='QSD'
        staged={userStagedBalance}
        bonded={userBondedBalance}
        status={userStatus}
        lockup={lockup}
        disabled={!user}
        handleBond={(bondAmount) => {
          bond(QSDS.addr, toBaseUnitBN(bondAmount, QSD.decimals));
        }}
        handleUnbond={(unbondAmount) => {
          unbondUnderlying(QSDS.addr, toBaseUnitBN(unbondAmount, QSD.decimals));
        }}
      />
    </Layout>
  );
}

export default Wallet;
