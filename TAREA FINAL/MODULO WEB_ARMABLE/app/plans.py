from typing import Literal

PlanId = Literal['starter', 'professional', 'business', 'agency']
PLANS = {
    'starter': {'name': 'Starter', 'pages': 5, 'templates': 3, 'credits': 20},
    'professional': {'name': 'Professional', 'pages': 30, 'templates': 15, 'credits': 100},
    'business': {'name': 'Business', 'pages': 90, 'templates': 45, 'credits': 300},
    'agency': {'name': 'Agency', 'pages': 300, 'templates': 150, 'credits': 1000},
}
