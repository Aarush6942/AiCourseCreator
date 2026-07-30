import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { ErrorResponse, HealthStatus, LessonDay, LessonPlan, LessonPlanInput, LessonPlanSummary } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListLessonPlansUrl: () => string;
/**
 * @summary List all lesson plans
 */
export declare const listLessonPlans: (options?: RequestInit) => Promise<LessonPlanSummary[]>;
export declare const getListLessonPlansQueryKey: () => readonly ["/api/lesson-plans"];
export declare const getListLessonPlansQueryOptions: <TData = Awaited<ReturnType<typeof listLessonPlans>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLessonPlans>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLessonPlans>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLessonPlansQueryResult = NonNullable<Awaited<ReturnType<typeof listLessonPlans>>>;
export type ListLessonPlansQueryError = ErrorType<unknown>;
/**
 * @summary List all lesson plans
 */
export declare function useListLessonPlans<TData = Awaited<ReturnType<typeof listLessonPlans>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLessonPlans>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateLessonPlanUrl: () => string;
/**
 * @summary Generate a new 10-day lesson plan using AI
 */
export declare const createLessonPlan: (lessonPlanInput: LessonPlanInput, options?: RequestInit) => Promise<LessonPlan>;
export declare const getCreateLessonPlanMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createLessonPlan>>, TError, {
        data: BodyType<LessonPlanInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createLessonPlan>>, TError, {
    data: BodyType<LessonPlanInput>;
}, TContext>;
export type CreateLessonPlanMutationResult = NonNullable<Awaited<ReturnType<typeof createLessonPlan>>>;
export type CreateLessonPlanMutationBody = BodyType<LessonPlanInput>;
export type CreateLessonPlanMutationError = ErrorType<ErrorResponse>;
/**
* @summary Generate a new 10-day lesson plan using AI
*/
export declare const useCreateLessonPlan: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createLessonPlan>>, TError, {
        data: BodyType<LessonPlanInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createLessonPlan>>, TError, {
    data: BodyType<LessonPlanInput>;
}, TContext>;
export declare const getGetLessonPlanUrl: (id: number) => string;
/**
 * @summary Get a lesson plan with all days
 */
export declare const getLessonPlan: (id: number, options?: RequestInit) => Promise<LessonPlan>;
export declare const getGetLessonPlanQueryKey: (id: number) => readonly [`/api/lesson-plans/${number}`];
export declare const getGetLessonPlanQueryOptions: <TData = Awaited<ReturnType<typeof getLessonPlan>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLessonPlan>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLessonPlan>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLessonPlanQueryResult = NonNullable<Awaited<ReturnType<typeof getLessonPlan>>>;
export type GetLessonPlanQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get a lesson plan with all days
 */
export declare function useGetLessonPlan<TData = Awaited<ReturnType<typeof getLessonPlan>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLessonPlan>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getDeleteLessonPlanUrl: (id: number) => string;
/**
 * @summary Delete a lesson plan and all its days
 */
export declare const deleteLessonPlan: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteLessonPlanMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteLessonPlan>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteLessonPlan>>, TError, {
    id: number;
}, TContext>;
export type DeleteLessonPlanMutationResult = NonNullable<Awaited<ReturnType<typeof deleteLessonPlan>>>;
export type DeleteLessonPlanMutationError = ErrorType<ErrorResponse>;
/**
* @summary Delete a lesson plan and all its days
*/
export declare const useDeleteLessonPlan: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteLessonPlan>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteLessonPlan>>, TError, {
    id: number;
}, TContext>;
export declare const getDeleteLessonDayUrl: (id: number, dayNumber: number) => string;
/**
 * @summary Delete a specific day from a lesson plan
 */
export declare const deleteLessonDay: (id: number, dayNumber: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteLessonDayMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteLessonDay>>, TError, {
        id: number;
        dayNumber: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteLessonDay>>, TError, {
    id: number;
    dayNumber: number;
}, TContext>;
export type DeleteLessonDayMutationResult = NonNullable<Awaited<ReturnType<typeof deleteLessonDay>>>;
export type DeleteLessonDayMutationError = ErrorType<ErrorResponse>;
/**
* @summary Delete a specific day from a lesson plan
*/
export declare const useDeleteLessonDay: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteLessonDay>>, TError, {
        id: number;
        dayNumber: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteLessonDay>>, TError, {
    id: number;
    dayNumber: number;
}, TContext>;
export declare const getRegenerateQuizUrl: (id: number, dayNumber: number) => string;
/**
 * @summary Generate a fresh quiz for a specific day
 */
export declare const regenerateQuiz: (id: number, dayNumber: number, options?: RequestInit) => Promise<LessonDay>;
export declare const getRegenerateQuizMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof regenerateQuiz>>, TError, {
        id: number;
        dayNumber: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof regenerateQuiz>>, TError, {
    id: number;
    dayNumber: number;
}, TContext>;
export type RegenerateQuizMutationResult = NonNullable<Awaited<ReturnType<typeof regenerateQuiz>>>;
export type RegenerateQuizMutationError = ErrorType<ErrorResponse>;
/**
* @summary Generate a fresh quiz for a specific day
*/
export declare const useRegenerateQuiz: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof regenerateQuiz>>, TError, {
        id: number;
        dayNumber: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof regenerateQuiz>>, TError, {
    id: number;
    dayNumber: number;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map