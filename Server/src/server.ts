import express from 'express'

const app = express()
const port = 3000

const fee = 0.05 // 0.01 = 1%

function countLiquidity (sharesHeld: number[]): number {
  return sharesHeld.reduce((acc, val) => acc + val, 0)
}

function calculateMarginalPrice (team: number, sharesHeld: number[]): number {
  const liquidity = countLiquidity(sharesHeld)
  const exps = sharesHeld.map(shares => Math.exp(shares / liquidity))
  const sumExp = exps.reduce((acc, val) => acc + val, 0)
  return exps[team] / sumExp
}

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

  if (transactionCost > userBalances[userId]) {
    console.log('Not enough balance')
    return userShares
  }

  userBalances[userId] -= transactionCost

  return newUserShares
}

interface UserShare { [key: number]: number }

const userBalances: UserShare = { 1: 1000, 2: 1000, 3: 1000, 4: 1000 }
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
  const odds: number[] = bets.map((_, i) => {
    return calculateMarginalPrice(i, bets).toFixed(4) as unknown as number
  })

  const liquidity = countLiquidity(bets)

  res.send(JSON.stringify({
    bets,
    odds,
    yourBets: userShares.map((shares, team) => {
      const userBets = shares[userId] ?? 0
      return {
        shares: userBets,
        winPayout: liquidity * Math.floor(100 * (userBets / bets[team])) / 100
      }
    })
  }))
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
