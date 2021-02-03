import { Button } from '@aragon/ui';
import React, { ComponentProps, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Layout } from '@aragon/ui';
import { IconHeader, Row, Tile, TopBorderBox } from '../common';
import Regulation from '../Regulation';
import { QSD, QSDS } from '../../constants/tokens';
import {
  getDaoIsBootstrapping,
  getExpansionAmount,
  getInstantaneousQSDPrice,
  getLPBondedLiquidity,
  getPoolTotalBonded,
  getTokenTotalSupply,
  getTotalBonded,
  getUniswapLiquidity,
} from '../../utils/infura';
import { formatBN, toFloat, toTokenUnitsBN } from '../../utils/number';
import { epochformatted } from '../../utils/calculation';
import BigNumber from 'bignumber.js';
import { getPoolBondingAddress } from '../../utils/pool';

type HomePageProps = {
  user: string;
};

function HomePage({ user }: HomePageProps) {
  const [epochTime, setEpochTime] = useState('0-00:00:00');
  const [totalSupply, setTotalSupply] = useState<BigNumber | null>(null);
  const [qsdPrice, setQSDPrice] = useState<BigNumber | null>(null);
  const [qsdLiquidity, setQSDLiquidity] = useState<BigNumber | null>(null);
  const [daiLiquidity, setDAILiquidity] = useState<BigNumber | null>(null);

  const [daoBonded, setDaoBonded] = useState<BigNumber | null>(null);
  const [lpQsdLiquidity, setLpQsdLiquidity] = useState<number | null>(null);
  const [lpDaiLiquidity, setLpDaiLiquidity] = useState<number | null>(null);
  const [expansionAmount, setExpansionAmount] = useState<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function updateInfo() {
      const poolBonding = await getPoolBondingAddress();

      const [
        supply,
        tokenPrice,
        liquidity,
        liquidityLp,
        expansion,
        bootstrapping,
        daoBonded,
        bondingBonded,
      ] = await Promise.all([
        getTokenTotalSupply(QSD.addr),
        getInstantaneousQSDPrice(),
        getUniswapLiquidity(),
        getLPBondedLiquidity(),
        getExpansionAmount(),
        getDaoIsBootstrapping(),
        getTotalBonded(QSDS.addr),
        getPoolTotalBonded(poolBonding),
      ]);

      setTotalSupply(toTokenUnitsBN(supply, 18));
      setQSDPrice(toTokenUnitsBN(tokenPrice, 18));
      setQSDLiquidity(toTokenUnitsBN(liquidity.qsd, 18));
      setDAILiquidity(toTokenUnitsBN(liquidity.dai, 18));
      setLpQsdLiquidity(liquidityLp.qsd);
      setLpDaiLiquidity(liquidityLp.dai);
      setExpansionAmount(expansion);

      if (bootstrapping) {
        setDaoBonded(toTokenUnitsBN(daoBonded, 18));
      } else {
        setDaoBonded(toTokenUnitsBN(bondingBonded, 18));
      }
    }

    async function updateUserInfo() {
      if (!isCancelled) {
        setEpochTime(epochformatted());
      }
    }

    updateInfo();
    updateUserInfo();

    const id = setInterval(updateUserInfo, 1000);

    // eslint-disable-next-line consistent-return
    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, [user]);

  let daoWeeklyYield = '...';
  let daoHourlyYield = '...';
  let daoDailyYield = '...';

  let lpWeeklyYield = '...';
  let lpHourlyYield = '...';
  let lpDailyYield = '...';

  // Define number formatting
  var options = { minimumFractionDigits: 0,
                maximumFractionDigits: 2 };
  var numberFormat = new Intl.NumberFormat('en-US', options);

  // Calculate LP APR (4 hrs)
  if (qsdPrice && lpQsdLiquidity && lpDaiLiquidity && expansionAmount) {
    const totalDAI = lpQsdLiquidity * toFloat(qsdPrice) + lpDaiLiquidity;
    const daiToAdd = (expansionAmount / 2) * toFloat(qsdPrice);

    const lpYield = (daiToAdd / totalDAI) * 100;

    lpHourlyYield = numberFormat.format(lpYield / 4) + '%';
    lpDailyYield = numberFormat.format(lpYield * 6) + '%';
    lpWeeklyYield = numberFormat.format(lpYield * 6 * 7) + '%';
  }

  // Calculate DAO APR (4 hrs)
  if (qsdPrice && daoBonded && expansionAmount) {
    const totalQSD = toFloat(daoBonded);
    const qsdToAdd = expansionAmount / 2;

    const daoYield = (qsdToAdd / totalQSD) * 100;

    daoHourlyYield = numberFormat.format(daoYield / 4) + '%';
    daoDailyYield = numberFormat.format(daoYield * 6) + '%';
    daoWeeklyYield = numberFormat.format(daoYield * 6 * 7) + '%';
  }

  const curEpoch = Number(epochTime.split('-')[0]);

  return (
    <Layout>
      <div style={{ margin: '60px 0' }}>
        <Row>
          <Tile
            line1='Epoch'
            line2={epochTime}
            line3={`Advance -> ${curEpoch + 1}`}
          />
          <Tile
            line1='Total Supply'
            line2={totalSupply === null ? '...' : formatBN(totalSupply, 2)}
            line3={`${
              Number(epochTime.split('-')[0]) < 108
                ? 'Bootstrapping phase'
                : qsdPrice?.isGreaterThan(
                    new BigNumber(10).pow(new BigNumber(18))
                  )
                ? 'Above Peg'
                : 'Idle phase'
            }`}
          />
          <Tile
            line1='Market Cap'
            line2={`${
              totalSupply !== null && qsdPrice !== null
                ? '$' + formatBN(totalSupply.multipliedBy(qsdPrice), 2)
                : '...'
            }`}
            line3=''
          />
        </Row>

        <Section>
          <IconHeader
            icon={<i className='fas fa-exchange-alt' />}
            text='Trade'
          />
          <Row>
            <TopBorderBox
              title='QSD Price'
              body={qsdPrice ? formatBN(qsdPrice, 2) + ' DAI' : '...'}
              action={
                <Button>
                  <a
                    target='_blank'
                    rel="noopener noreferrer" 
                    style={{ textDecoration: 'none' }}
                    href={`https://app.uniswap.org/#/swap?outputCurrency=${QSD.addr}`}
                  >
                    Trade QSD
                  </a>
                </Button>
              }
            />
            <TopBorderBox
              title='QSD Info'
              body={qsdLiquidity ? formatBN(qsdLiquidity, 2) + ' QSD' : '...'}
              action={
                <Button>
                  <a
                    target='_blank'
                    rel="noopener noreferrer" 
                    style={{ textDecoration: 'none' }}
                    href={`https://info.uniswap.org/token/${QSD.addr}`}
                  >
                    Trade Info
                  </a>
                </Button>
              }
            />
            <TopBorderBox
              title='QSD Liquidity'
              body={daiLiquidity ? formatBN(daiLiquidity, 2) + ' DAI' : '...'}
              action={
                <Button>
                  <a
                    target='_blank'
                    rel="noopener noreferrer" 
                    style={{ textDecoration: 'none' }}
                    href={`https://app.uniswap.org/#/add/${QSD.addr}/0x6b175474e89094c44da98b954eedeac495271d0f`}
                  >
                    Add Liquidity
                  </a>
                </Button>
              }
            />
          </Row>
        </Section>

        <Section>
          <IconHeader
            icon={<i className='fas fa-chart-line' />}
            text='Invest'
          />
          <Row>
            <TopBorderBox
              title='Bonded QSD APR'
              body={
                <>
                  <div>QSD Hourly: {daoHourlyYield} </div>
                  <div>QSD Daily: {daoDailyYield} </div>
                  <div>QSD Weekly: {daoWeeklyYield} </div>
                </>
              }
              action={
                <NavLink
                  component={Button}
                  to={curEpoch < 72 ? '/bootstrapping' : '/qsd'}
                  {...{ external: false }}
                >
                  Add QSD
                </NavLink>
              }
            />
            <TopBorderBox
              title='Bonded LP APR'
              body={
                <>
                  <div>LP Hourly: {lpHourlyYield} </div>
                  <div>LP Daily: {lpDailyYield} </div>
                  <div>LP Weekly: {lpWeeklyYield} </div>
                </>
              }
              action={
                <NavLink component={Button} to='/lp' {...{ external: false }}>
                  Add LP
                </NavLink>
              }
            />
          </Row>
        </Section>

        <Section>
          <Regulation user={user} hideHistory />
          <div style={{ textAlign: 'center', marginTop: 22 }}>
            <NavLink
              component={Button}
              to='/regulation'
              {...{ external: false }}
            >
              View more
            </NavLink>
          </div>
        </Section>
      </div>
    </Layout>
  );
}

function Section(props: ComponentProps<'div'>) {
  return <div style={{ marginTop: 80 }} {...props} />;
}

export default HomePage;
