import express from 'express'
import path from 'path'

const app = express()
const port = 3000

const fee = 0.05 // 0.01 = 1%
const initialLiquidity = 0 // Initial liquidity for the market

interface Balances { [key: number]: number }

interface Bet {
  userId: number
  team: number
  amount: number
  remainingAmount: number
  odds: number[]
  status: 'unmatched' | 'partially matched' | 'matched'
}

const userBalances: Balances = { 1: 1000, 2: 1000, 3: 1000, 4: 1000 }
let teamFunds: Balances = { 0: initialLiquidity, 1: initialLiquidity } // Initial funds for each team
const bets: Bet[] = []
const unmatchedBets: Bet[] = []

function calculateTotalFunds (funds: Balances): number {
  return Object.values(funds).reduce((acc: number, val: number) => acc + val, 0)
}

function calculateOdds (funds: Balances): number[] {
  const totalFunds = calculateTotalFunds(funds)
  const exps = Object.values(funds).map(fund => Math.exp(fund / totalFunds))
  return exps
}

function calculateCost (funds: Balances): number {
  const totalFunds = calculateTotalFunds(funds)
  const exps = Object.values(funds).map(fund => Math.exp(fund / totalFunds))
  const sumExp = exps.reduce((acc: number, val: number) => acc + val, 0)
  const lnSumExp = Math.log(sumExp)
  const result = totalFunds * lnSumExp
  if (Number.isNaN(result)) return 0
  return result
}

function matchBet (bet: Bet): Bet | null {
  for (let i = 0; i < unmatchedBets.length; i++) {
    const unmatchedBet = unmatchedBets[i]
    if (unmatchedBet.team !== bet.team && unmatchedBet.remainingAmount > 0) {
      const matchedAmount = Math.min(bet.remainingAmount, unmatchedBet.remainingAmount)
      unmatchedBet.remainingAmount -= matchedAmount
      bet.remainingAmount -= matchedAmount

      if (unmatchedBet.remainingAmount === 0) {
        unmatchedBet.status = 'matched'
        unmatchedBets.splice(i, 1)
      } else {
        unmatchedBet.status = 'partially matched'
      }

      if (bet.remainingAmount === 0) {
        bet.status = 'matched'
        return unmatchedBet
      } else {
        bet.status = 'partially matched'
      }
    }
  }
  return null
}

function placeBet (userBalances: Balances, funds: Balances, userId: number, team: number, cashAmount: number): Balances {
  const initialCost = calculateCost(funds)

  if (cashAmount === undefined || cashAmount === null || cashAmount <= 0) {
    console.log('No cash amount specified')
    return funds
  }

  cashAmount *= 1 - fee

  if (team === undefined || funds[team] === undefined) {
    console.log('Invalid team')
    return funds
  }

  if (userBalances[userId] < cashAmount) {
    console.log('Not enough balance')
    return funds
  }

  const newFunds = { ...funds }
  newFunds[team] += cashAmount

  const transactionCost = calculateCost(newFunds) - initialCost

  if (transactionCost > userBalances[userId]) {
    console.log('Not enough balance after transaction')
    return funds
  }

  userBalances[userId] -= transactionCost

  const odds = calculateOdds(newFunds)
  const newBet: Bet = { userId, team, amount: cashAmount, remainingAmount: cashAmount, odds, status: 'unmatched' }

  const matchedBet = matchBet(newBet)
  if (matchedBet == null) {
    unmatchedBets.push(newBet)
  }

  bets.push(newBet)
  return newFunds
}

function probabilityToDecimalOdds (probability: number): string {
  return (1 / probability).toFixed(2)
}

app.use(express.static(path.join(__dirname, 'public')))

app.get('/bets', (req, res) => {
  const userId: number = parseInt(req.query.userId as string)
  const team: number = parseInt(req.query.team as string)
  const cashAmount: number = parseInt(req.query.cashAmount as string)

  if (cashAmount === undefined || cashAmount === null || cashAmount <= 0) {
    res.send('No cash amount specified')
    return
  }

  if (team === undefined || teamFunds[team] === undefined) {
    res.send('Invalid team')
    return
  }

  teamFunds = placeBet(userBalances, teamFunds, userId, team, cashAmount)

  const odds: string[] = Object.keys(teamFunds).map(teamKey => {
    const teamIndex = parseInt(teamKey)
    return probabilityToDecimalOdds(calculateOdds(teamFunds)[teamIndex])
  })

  const totalFunds = calculateTotalFunds(teamFunds)

  res.send(JSON.stringify({
    odds,
    yourBets: bets.filter(bet => bet.userId === userId),
    allBets: bets,
    totalFunds,
    unmatchedBets
  }))
})

app.get('/odds-on-offer', (req, res) => {
  const cashAmount: number = parseInt(req.query.cashAmount as string)

  if (cashAmount === undefined || cashAmount === null || cashAmount <= 0) {
    res.send('No cash amount specified')
    return
  }

  const newFunds = { ...teamFunds, 0: teamFunds[0] + cashAmount, 1: teamFunds[1] }
  const oddsOnOffer = Object.keys(newFunds).map(teamKey => {
    const teamIndex = parseInt(teamKey)
    return probabilityToDecimalOdds(calculateOdds(newFunds)[teamIndex])
  })

  res.send(JSON.stringify({
    oddsOnOffer
  }))
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
