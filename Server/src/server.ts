import express from 'express'

const app = express()
const port = 3000

const fee = 0.05 // 0.01 = 1%

function countLiquidity (sharesHeld: number[]): number {
  return sharesHeld.reduce((acc, val) => acc + val, 0)
}

function calculateOdds (sharesHeld: number[]): number[] {
  const liquidity = countLiquidity(sharesHeld)
  const exps = sharesHeld.map(shares => Math.exp(shares / liquidity))
  return exps
}

// function calculateMarginalPrice (team: number, sharesHeld: number[]): number {
//   const liquidity = countLiquidity(sharesHeld)
//   console.log('Liquidity:', sharesHeld)
//   const exps = sharesHeld.map(shares => Math.exp(shares / liquidity))
//   console.log('Exps:', exps)
//   const sumExp = exps.reduce((acc, val) => acc + val, 0)
//   return exps[team] / sumExp
// }

function countBets (userShares: UserShare[]): number[] {
  return Object.values(userShares.reduce((acc, curr) => {
    const index = Object.keys(acc).length
    acc[index] = Object.values(curr).reduce((a: number, b: number) => a + b, 0)
    return acc
  }, {}))
}

function calculateCost (sharesHeld: number[]): number {
  const liquidity = countLiquidity(sharesHeld)
  const exps = sharesHeld.map(shares => Math.exp(shares / liquidity))
  const sumExp = exps.reduce((acc, val) => acc + val, 0)
  const lnSumExp = Math.log(sumExp)
  const result = liquidity * lnSumExp
  if (Number.isNaN(result)) return 0
  return result
}

function placeBet (userShares: UserShare[], userId: number, team: number, sharesBought: number): UserShare[] {
  const initialCost = calculateCost(countBets(userShares))

  if (sharesBought === undefined || sharesBought === null || sharesBought <= 0) {
    console.log('No shares bought')
    return userShares
  }

  sharesBought *= 1 - fee

  if (team === undefined || userShares[team] === undefined) {
    console.log('Invalid team')
    return userShares
  }

  const newUserShares = userShares

  if (newUserShares[team][userId] === undefined) newUserShares[team][userId] = 0
  newUserShares[team][userId] += sharesBought

  const transactionCost = calculateCost(countBets(userShares)) - initialCost

  if (transactionCost > userBalances[userId] && userBalances[userId] !== undefined && userBalances[userId] !== null) {
    console.log('Not enough balance')
    return userShares
  }

  userBalances[userId] -= transactionCost
  if (dollarsBet[userId] === undefined) dollarsBet[userId] = 0
  dollarsBet[userId] += transactionCost

  console.log('Paid $' + (transactionCost as unknown as string) + ' for ' + (sharesBought as unknown as string) + ' shares on team ' + (team as unknown as string) + ' by user ' + (userId as unknown as string))

  return newUserShares
}

interface UserShare { [key: number]: number }

const userBalances: UserShare = { 1: 1000, 2: 1000, 3: 1000, 4: 1000 }
const dollarsBet: UserShare = { 0: 2 }
let userShares: UserShare[] = [{ 0: 1 }, { 0: 1 }]

// app.get('/bets', (_, res) => {
//   const bets = countBets(userShares)
//   const odds = bets.map((_, i) => {
//     return calculateMarginalPrice(i, bets).toFixed(4)
//   })

//   res.send(JSON.stringify({
//     bets,
//     odds
//   }))
// })

app.get('/bets', (req, res) => {
  res.header('Content-Type', 'application/json')
  const userId: number = parseInt(req.query.userId as unknown as string)
  const team: number = parseInt(req.query.team as unknown as string)
  const sharesBought: number = parseInt(req.query.sharesBought as unknown as string)

  if (sharesBought === undefined || sharesBought === null || sharesBought <= 0) {
    res.send('No shares bought')
  }

  if (team === undefined || userShares[team] === undefined) {
    res.send('Invalid team')
    return
  }

  userShares = placeBet(userShares, userId, team, sharesBought)

  const bets = countBets(userShares)
  const odds: number[] = calculateOdds(bets)

  const liquidity = countLiquidity(bets)

  res.send(JSON.stringify({
    bets,
    odds,
    yourBets: userShares.map((shares, team) => {
      const userBets = shares[userId] ?? 0
      return {
        shares: userBets,
        winPayout: liquidity * Math.floor(100 * (userBets / bets[team])) / 100,
        dollarsBet: dollarsBet[userId] ?? 0
      }
    })
  }))
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
